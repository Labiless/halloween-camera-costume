<script>
  import { GIFS, GIF_MIN_SECONDS, GIF_MAX_SECONDS, GLITCH_SECONDS } from '../../config/gifs.js';
  import { loadGif } from '../gifPlayer.js';

  let canvas;
  let status = $state('');

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function makeCanvas(w = 1, h = 1) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Alcuni fotogrammi di rumore pronti, per la "neve" del segnale disturbato
  function makeNoise() {
    const c = makeCanvas(256, 144);
    const g = c.getContext('2d');
    const img = g.createImageData(256, 144);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v * 0.55;
      img.data[i + 2] = v * 0.45;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  $effect(() => {
    const ctx = canvas.getContext('2d');
    // Le GIF sono a bassa risoluzione: renderizziamo a 1x, gli effetti costano meno
    const buf = makeCanvas();
    const bctx = buf.getContext('2d');
    const chan = makeCanvas();
    const cctx = chan.getContext('2d');
    const noise = [makeNoise(), makeNoise(), makeNoise()];
    let W, H, raf;
    let stopped = false;

    // Stato della sequenza
    let current = null;
    let next = null;
    let loadingNext = false;
    let showUntil = Infinity;
    let transStart = -1;
    let swapped = false;
    let bag = [];
    let lastUrl = null;
    let ambientUntil = 0;

    function resize() {
      W = canvas.width = buf.width = chan.width = innerWidth;
      H = canvas.height = buf.height = chan.height = innerHeight;
    }

    // Ordine casuale senza ripetere la stessa GIF due volte di fila
    function nextUrl() {
      if (!bag.length) {
        bag = GIFS.map((u) => u.trim()).sort(() => Math.random() - 0.5);
        if (bag.length > 1 && bag[0] === lastUrl) bag.push(bag.shift());
      }
      return (lastUrl = bag.shift());
    }

    // Ogni GIF viene scaricata una volta sola e riusata: con cambi rapidi
    // non c'è tempo di riscaricarle ogni volta
    const cache = new Map();
    function getGif(url) {
      if (!cache.has(url)) cache.set(url, loadGif(url));
      return cache.get(url);
    }

    async function prepareNext() {
      if (loadingNext) return;
      loadingNext = true;
      for (let tries = 0; tries < GIFS.length && !stopped; tries++) {
        try {
          next = await getGif(nextUrl());
          break;
        } catch (err) {
          console.warn(err);
        }
      }
      loadingNext = false;
    }

    function drawCover(gif, now) {
      gif.tick(now);
      const img = gif.image();
      const s = Math.max(W / gif.width, H / gif.height);
      const w = gif.width * s;
      const h = gif.height * s;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }

    // ---------- Effetti glitch, k = intensità 0..1 ----------
    function pixelate(k) {
      const block = Math.round(2 + k * 28);
      const w = Math.max(1, Math.round(W / block));
      const h = Math.max(1, Math.round(H / block));
      bctx.imageSmoothingEnabled = false;
      bctx.clearRect(0, 0, W, H);
      bctx.drawImage(canvas, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, 0, 0, w, h, 0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
    }

    // Separazione dei canali RGB con spostamenti diversi
    function rgbSplit(k) {
      const off = k * 40;
      bctx.drawImage(canvas, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const [color, dx, dy] of [['#f00', -off, rand(-1, 1) * off * 0.3], ['#0f0', 0, 0], ['#00f', off, rand(-1, 1) * off * 0.3]]) {
        cctx.globalCompositeOperation = 'copy';
        cctx.drawImage(buf, 0, 0);
        cctx.globalCompositeOperation = 'multiply';
        cctx.fillStyle = color;
        cctx.fillRect(0, 0, W, H);
        ctx.drawImage(chan, dx, dy);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function slices(k) {
      const n = Math.floor(2 + k * 14);
      for (let i = 0; i < n; i++) {
        const y = rand(0, H);
        const h = rand(3, 10 + k * 70);
        ctx.drawImage(canvas, 0, y, W, h, rand(-1, 1) * k * W * 0.2, y, W, h);
      }
    }

    // Perdita di sincronia verticale: l'immagine "scivola" in alto
    function verticalRoll(k) {
      const dy = Math.round(rand(0, k * H * 0.3));
      if (dy < 2) return;
      bctx.drawImage(canvas, 0, 0);
      ctx.drawImage(buf, 0, -dy);
      ctx.drawImage(buf, 0, H - dy);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, H - dy - 4, W, 8);
    }

    function snow(k) {
      ctx.globalAlpha = Math.min(1, k * 0.85);
      ctx.drawImage(pick(noise), 0, 0, W, H);
      ctx.globalAlpha = 1;
      // Bande di rumore piene
      const bands = Math.floor(k * 4);
      for (let i = 0; i < bands; i++) {
        const y = rand(0, H);
        ctx.drawImage(pick(noise), 0, rand(0, 100), 256, 20, 0, y, W, rand(6, 40));
      }
    }

    function glitch(k) {
      if (k <= 0.01) return;
      if (k > 0.35) pixelate(k);
      rgbSplit(k);
      slices(k);
      if (Math.random() < k * 0.5) verticalRoll(k);
      snow(k);
      // Lampi: rosso o nero
      const r = Math.random();
      if (r < k * 0.15) {
        ctx.fillStyle = 'rgba(255,20,0,0.35)';
        ctx.fillRect(0, 0, W, H);
      } else if (r < k * 0.3) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
    }

    function frame(now) {
      if (stopped) return;
      const t = now / 1000;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      let k = 0;
      if (transStart >= 0) {
        const p = (t - transStart) / GLITCH_SECONDS;
        // Sale fino a metà transizione, lì cambia GIF, poi si riassesta
        k = Math.pow(1 - Math.abs(2 * p - 1), 0.6);
        if (p >= 0.5 && !swapped) {
          swapped = true;
          if (next) {
            current = next;
            next = null;
          }
          prepareNext();
        }
        if (p >= 1) {
          transStart = -1;
          showUntil = t + rand(GIF_MIN_SECONDS, GIF_MAX_SECONDS);
        }
      } else if (t > showUntil && next) {
        transStart = t;
        swapped = false;
      } else if (t > ambientUntil + 2 && Math.random() < 0.004) {
        // Piccoli disturbi anche mentre la GIF è a schermo
        ambientUntil = t + rand(0.08, 0.25);
      }
      if (t < ambientUntil) k = Math.max(k, rand(0.1, 0.3));

      if (current) drawCover(current, now);
      glitch(k);
      raf = requestAnimationFrame(frame);
    }

    async function start() {
      if (!GIFS.length) {
        status = 'NESSUNA GIF CONFIGURATA\nsrc/config/gifs.js';
        return;
      }
      status = 'CARICAMENTO...';
      GIFS.forEach((url) => getGif(url.trim()).catch(() => {})); // precarica tutto in parallelo
      await prepareNext();
      if (stopped) return;
      if (!next) {
        status = 'NESSUNA GIF CARICABILE\ncontrolla i link in src/config/gifs.js';
        return;
      }
      status = '';
      // Si entra nella scena già con un glitch
      transStart = performance.now() / 1000;
      swapped = false;
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      for (const p of cache.values()) p.then((gif) => gif.close()).catch(() => {});
    };
  });
</script>

<canvas bind:this={canvas}></canvas>
<div class="grade"></div>
{#if status}
  <div class="status">{status}</div>
{/if}

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    /* Toni bruciati, da fine del mondo */
    filter: contrast(1.25) saturate(1.2) sepia(0.3);
  }

  /* Scanline e vignettatura fisse sopra le GIF */
  .grade {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.8) 100%),
      repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0, 0, 0, 0.3) 2px 3px);
  }

  .status {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    text-align: center;
    white-space: pre-line;
    color: #ff3a3a;
    text-shadow: 0 0 8px #f00;
    font-size: clamp(12px, 3.5vmin, 24px);
    letter-spacing: 0.15em;
  }
</style>
