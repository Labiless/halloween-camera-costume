<script>
  import { gaze } from '../gaze.svelte.js';

  let canvas;

  const rand = (a, b) => a + Math.random() * (b - a);
  const damp = (cur, target, speed, dt) => cur + (target - cur) * (1 - Math.exp(-speed * dt));

  $effect(() => {
    const ctx = canvas.getContext('2d');
    let W, H, dpr, cx, cy, R; // R = raggio della lente
    let bezel, lensBg, glass; // layer statici pre-renderizzati
    let raf;

    // ---------- Stato dell'occhio ----------
    const eye = {
      x: 0, y: 0, // posizione attuale dello sguardo [-1, 1]
      tx: 0, ty: 0, // obiettivo
      pupil: 0.5, pupilTarget: 0.5, // dimensione del nucleo luminoso
      zoom: 1, zoomTarget: 1, // "messa a fuoco": la luce si intensifica
      shutter: 0, // 0 = aperto, 1 = diaframma chiuso (battito)
      squint: 0, squintTarget: 0, // diaframma socchiuso, sguardo cattivo
      nextSaccade: 0,
      nextPupil: 0,
      nextBlink: 0,
      blinkStart: -1,
      blinkCount: 0,
    };

    // ---------- Pre-rendering ----------
    function makeLayer(w, h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.width = Math.round(innerWidth * dpr);
      H = canvas.height = Math.round(innerHeight * dpr);
      cx = W / 2;
      cy = H / 2;
      // Il telefono è in orizzontale: la lente occupa quasi tutta l'altezza
      // e la ghiera cromata esce un po' dallo schermo.
      R = (Math.min(W, H) / 2) * 0.97;
      bezel = drawBezel();
      lensBg = drawLensBg();
      glass = drawGlass();
    }

    function drawBezel() {
      const S = Math.ceil(R * 2.6);
      const c = makeLayer(S, S);
      const g = c.getContext('2d');
      g.translate(S / 2, S / 2);

      // Ghiera cromata, spazzolata
      let metal;
      if (g.createConicGradient) {
        metal = g.createConicGradient(-Math.PI / 3, 0, 0);
        const stops = ['#e8e8ea', '#6a6a70', '#f4f4f6', '#3a3a3e', '#bfc0c4', '#55555a', '#f0f0f2', '#4a4a4e', '#e8e8ea'];
        stops.forEach((s, i) => metal.addColorStop(i / (stops.length - 1), s));
      } else {
        metal = g.createLinearGradient(-R, -R, R, R);
        metal.addColorStop(0, '#eee');
        metal.addColorStop(0.5, '#444');
        metal.addColorStop(1, '#ccc');
      }
      g.fillStyle = metal;
      g.beginPath();
      g.arc(0, 0, R * 1.28, 0, Math.PI * 2);
      g.arc(0, 0, R * 1.03, 0, Math.PI * 2, true);
      g.fill();

      // Spazzolatura: sottili cerchi concentrici
      for (let r = 1.035; r < 1.28; r += 0.004) {
        g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${rand(0.02, 0.07)})`;
        g.lineWidth = 1 * dpr;
        g.beginPath();
        g.arc(0, 0, R * r, 0, Math.PI * 2);
        g.stroke();
      }

      // Smusso interno: anello scuro che porta dentro la lente
      const bevel = g.createRadialGradient(0, 0, R * 0.98, 0, 0, R * 1.06);
      bevel.addColorStop(0, '#000');
      bevel.addColorStop(0.6, '#1a1a1c');
      bevel.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = bevel;
      g.beginPath();
      g.arc(0, 0, R * 1.06, 0, Math.PI * 2);
      g.arc(0, 0, R * 0.99, 0, Math.PI * 2, true);
      g.fill();

      // Bordi netti
      g.lineWidth = 2 * dpr;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      for (const r of [1.03, 1.28]) {
        g.beginPath();
        g.arc(0, 0, R * r, 0, Math.PI * 2);
        g.stroke();
      }
      return c;
    }

    function drawLensBg() {
      const S = Math.ceil(R * 2);
      const c = makeLayer(S, S);
      const g = c.getContext('2d');
      g.translate(S / 2, S / 2);

      // Vetro nero profondo
      const bg = g.createRadialGradient(0, 0, 0, 0, 0, R);
      bg.addColorStop(0, '#0b0203');
      bg.addColorStop(0.7, '#040102');
      bg.addColorStop(1, '#000');
      g.fillStyle = bg;
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.fill();

      // Elementi interni dell'obiettivo appena visibili
      for (const [r, a] of [[0.93, 0.06], [0.78, 0.04], [0.62, 0.035], [0.45, 0.03]]) {
        g.strokeStyle = `rgba(255,80,80,${a})`;
        g.lineWidth = R * 0.008;
        g.beginPath();
        g.arc(0, 0, R * r, 0, Math.PI * 2);
        g.stroke();
      }
      return c;
    }

    function drawGlass() {
      const S = Math.ceil(R * 2);
      const c = makeLayer(S, S);
      const g = c.getContext('2d');
      g.translate(S / 2, S / 2);

      // Ombra sul bordo della cupola
      const edge = g.createRadialGradient(0, 0, R * 0.75, 0, 0, R);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(0,0,0,0.9)');
      g.fillStyle = edge;
      g.fillRect(-R, -R, R * 2, R * 2);

      // Grande riflesso curvo della cupola (in alto a sinistra)
      g.save();
      g.beginPath();
      g.arc(0, 0, R * 0.9, Math.PI * 1.02, Math.PI * 1.55);
      g.arc(-R * 0.08, -R * 0.08, R * 0.74, Math.PI * 1.55, Math.PI * 1.02, true);
      g.closePath();
      const sheen = g.createLinearGradient(-R * 0.9, -R * 0.9, -R * 0.2, -R * 0.2);
      sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.03)');
      g.fillStyle = sheen;
      g.filter = `blur(${R * 0.01}px)`;
      g.fill();
      g.restore();

      // Riflesso "finestra" più piccolo e netto
      g.save();
      g.translate(-R * 0.38, -R * 0.46);
      g.rotate(-0.7);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.filter = `blur(${R * 0.006}px)`;
      g.fillRect(-R * 0.09, -R * 0.045, R * 0.18, R * 0.09);
      g.restore();

      // Riflesso rossastro della luce sul lato opposto
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,60,40,0.10)';
      g.lineWidth = R * 0.04;
      g.filter = `blur(${R * 0.015}px)`;
      g.beginPath();
      g.arc(0, 0, R * 0.82, Math.PI * 0.15, Math.PI * 0.42);
      g.stroke();
      g.filter = 'none';
      return c;
    }

    // ---------- Comportamento ----------
    function update(t, dt) {
      if (gaze.manual) {
        eye.tx = gaze.x;
        eye.ty = gaze.y;
        eye.zoomTarget = 1;
        eye.squintTarget = 0;
      } else if (t > eye.nextSaccade) {
        // Saccade: scatto verso un nuovo punto, ogni tanto torna a fissare il centro
        if (Math.random() < 0.3) {
          eye.tx = rand(-0.08, 0.08);
          eye.ty = rand(-0.08, 0.08);
          eye.zoomTarget = 1.25; // "ti ho visto": la luce si intensifica
          eye.squintTarget = Math.random() < 0.6 ? 0.25 : 0;
          eye.pupilTarget = 0.25;
          eye.nextSaccade = t + rand(1.8, 3.5);
        } else {
          const a = rand(0, Math.PI * 2);
          const d = Math.sqrt(Math.random()) * 0.95;
          eye.tx = Math.cos(a) * d;
          eye.ty = Math.sin(a) * d * 0.8;
          eye.zoomTarget = 1;
          eye.squintTarget = 0;
          eye.nextSaccade = t + rand(0.5, 2.2);
        }
      }

      // Movimento rapido stile saccade + micro tremore
      eye.x = damp(eye.x, eye.tx, 16, dt) + rand(-1, 1) * 0.002;
      eye.y = damp(eye.y, eye.ty, 16, dt) + rand(-1, 1) * 0.002;

      if (t > eye.nextPupil) {
        eye.pupilTarget = rand(0.3, 0.9);
        eye.nextPupil = t + rand(1.5, 4);
      }
      eye.pupil = damp(eye.pupil, eye.pupilTarget, 4, dt);
      eye.zoom = damp(eye.zoom, eye.zoomTarget, 3, dt);
      eye.squint = damp(eye.squint, eye.squintTarget, 5, dt);

      // Battito: il diaframma si chiude e riapre (a volte due volte)
      if (eye.blinkStart < 0 && t > eye.nextBlink) {
        eye.blinkStart = t;
        eye.blinkCount = Math.random() < 0.25 ? 2 : 1;
      }
      let blink = 0;
      if (eye.blinkStart >= 0) {
        const BLINK = 0.32;
        const p = (t - eye.blinkStart) / BLINK;
        if (p >= eye.blinkCount) {
          eye.blinkStart = -1;
          eye.nextBlink = t + rand(3, 8);
        } else {
          blink = Math.sin((p % 1) * Math.PI);
        }
      }
      eye.shutter = Math.max(eye.squint, blink);
    }

    // ---------- Disegno ----------
    function drawAperture(closure) {
      if (closure < 0.005) return;
      const N = 9;
      const rOpen = R * (1 - closure) * 1.02;
      const rot = closure * 1.4;
      const pts = [];
      for (let i = 0; i < N; i++) {
        const a = rot + (i / N) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rOpen, cy + Math.sin(a) * rOpen]);
      }

      // Direzione di ogni lato del poligono: le lamelle sono le regioni
      // tra i prolungamenti di due lati consecutivi
      const dirs = pts.map(([x1, y1], i) => {
        const [x2, y2] = pts[(i + 1) % N];
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        return [(x2 - x1) / len, (y2 - y1) / len];
      });
      const far = R * 3;

      ctx.save();
      for (let i = 0; i < N; i++) {
        const a = pts[(i + 1) % N];
        const b = pts[(i + 2) % N];
        const da = dirs[i];
        const db = dirs[(i + 1) % N];
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(a[0] + da[0] * far, a[1] + da[1] * far);
        ctx.lineTo(b[0] + db[0] * far, b[1] + db[1] * far);
        ctx.lineTo(b[0], b[1]);
        ctx.closePath();
        const shade = i % 2 ? 0 : 8;
        const g = ctx.createLinearGradient(a[0], a[1], a[0] + da[0] * R, a[1] + da[1] * R);
        g.addColorStop(0, `rgb(${46 + shade},${44 + shade},${48 + shade})`);
        g.addColorStop(1, '#0a0a0c');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      }
      // Filo di luce sul bordo interno di ogni lamella
      ctx.strokeStyle = 'rgba(200,200,215,0.3)';
      ctx.lineWidth = 1 * dpr;
      for (let i = 0; i < N; i++) {
        const [x, y] = pts[(i + 1) % N];
        const d = dirs[i];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + d[0] * R * 2, y + d[1] * R * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawEye(t) {
      const maxOff = R * 0.42;
      const ox = eye.x * maxOff;
      const oy = eye.y * maxOff;
      const d = Math.min(1, Math.hypot(eye.x, eye.y));
      const ang = Math.atan2(eye.y, eye.x);
      const pulse = 0.88 + Math.sin(t * 1.7) * 0.08 + Math.sin(t * 6.1) * 0.03;
      const k = pulse * eye.zoom;

      ctx.globalCompositeOperation = 'lighter';

      // Alone rosso che riempie la lente, segue lo sguardo solo in parte
      const hx = cx + ox * 0.4;
      const hy = cy + oy * 0.4;
      const haze = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 1.1);
      haze.addColorStop(0, `rgba(170,0,0,${0.55 * k})`);
      haze.addColorStop(0.5, `rgba(90,0,0,${0.3 * k})`);
      haze.addColorStop(1, 'rgba(30,0,0,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      // Prospettiva: la luce si schiaccia nella direzione in cui guarda
      ctx.rotate(ang);
      ctx.scale(1 - 0.25 * d, 1);
      ctx.rotate(-ang);

      // Luce principale: rosso intenso che sfuma nel nero
      const r = R * 0.62 * (0.85 + 0.15 * eye.zoom);
      const light = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      light.addColorStop(0, `rgba(255,40,0,${Math.min(1, 0.95 * k)})`);
      light.addColorStop(0.18, `rgba(240,10,0,${0.9 * k})`);
      light.addColorStop(0.45, `rgba(150,0,0,${0.55 * k})`);
      light.addColorStop(1, 'rgba(40,0,0,0)');
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Nucleo giallo-bianco, la sua dimensione "respira"
      const cr = R * (0.05 + 0.06 * eye.pupil) * (0.9 + 0.2 * eye.zoom);
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, cr * 2.2);
      core.addColorStop(0, `rgba(255,250,215,${Math.min(1, k)})`);
      core.addColorStop(0.25, `rgba(255,220,90,${0.95 * k})`);
      core.addColorStop(0.55, `rgba(255,110,0,${0.6 * k})`);
      core.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, cr * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    function render(t) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(bezel, cx - bezel.width / 2, cy - bezel.height / 2);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(lensBg, cx - lensBg.width / 2, cy - lensBg.height / 2);
      drawEye(t);
      drawAperture(eye.shutter);
      ctx.drawImage(glass, cx - glass.width / 2, cy - glass.height / 2);
      ctx.restore();
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      update(t, dt);
      render(t);
      raf = requestAnimationFrame(frame);
    }

    eye.nextBlink = last / 1000 + rand(2, 4);

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  });
</script>

<canvas bind:this={canvas}></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
