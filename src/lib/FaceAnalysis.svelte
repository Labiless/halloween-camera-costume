<script>
  // Animazione di "analisi" della foto di un volto (~4s), poi chiama onDone.
  // snapshot: canvas quadrato col volto; keypoints: [[x,y]] normalizzati nella foto
  // (occhio dx, occhio sx, naso, bocca, orecchio dx, orecchio sx); from: riquadro di partenza in px CSS.
  let { snapshot, keypoints, id, from, onDone, onLog } = $props();

  const DURATION = 3.9;
  const FADE_OUT = 0.45;
  const GLYPHS = '█▓▒░#@$%&*!?/<>01ØΣΔ';
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rand = (a, b) => a + Math.random() * (b - a);

  // Posizioni plausibili se il detector non ha dato keypoint
  const FALLBACK_KP = [[0.36, 0.42], [0.64, 0.42], [0.5, 0.57], [0.5, 0.73], [0.14, 0.48], [0.86, 0.48]];
  const KP_NAMES = ['EYE_R', 'EYE_L', 'NOSE', 'MOUTH', 'EAR_R', 'EAR_L'];
  const LINKS = [[0, 1], [0, 2], [1, 2], [2, 3], [0, 4], [1, 5], [3, 4], [3, 5]];

  const fields = [
    { label: 'SUBJECT', value: `#${id}`, at: 0.9 },
    { label: 'MATCH', value: `${rand(91, 99.9).toFixed(2)}%`, at: 1.35 },
    { label: 'AGE EST', value: `${Math.floor(rand(18, 30))}-${Math.floor(rand(31, 45))}`, at: 1.8 },
    { label: 'HEART RATE', value: `${Math.floor(rand(88, 140))} BPM`, at: 2.2 },
    { label: 'SOUL', value: pick(['DETECTED', 'MISSING', 'HARVESTABLE', 'CORRUPTED']), at: 2.6 },
  ];
  const verdict = pick(['SUBJECT CATALOGUED', 'IDENTITY STORED', 'WE KNOW WHO YOU ARE', 'YOU HAVE BEEN SEEN']);
  const VERDICT_AT = 3.0;

  let t = $state(0);
  let photoEl;
  let canvas;

  // Testo che si "decodifica" carattere per carattere
  function typed(text, start) {
    if (t < start) return '';
    const n = Math.floor(((t - start) / 0.35) * text.length);
    return [...text].map((c, i) => (i < n || c === ' ' ? c : pick(GLYPHS))).join('');
  }

  let progress = $derived(Math.min(1, Math.max(0, (t - 0.3) / 2.6)));
  let opacity = $derived(t > DURATION - FADE_OUT ? Math.max(0, (DURATION - t) / FADE_OUT) : 1);
  let flash = $derived(Math.max(0, 1 - t / 0.25));

  $effect(() => {
    const ctx = canvas.getContext('2d');
    const kps = keypoints?.length >= 6 ? keypoints : FALLBACK_KP;
    const logged = new Set();
    const logAt = (at, text, alert) => {
      if (t >= at && !logged.has(at)) {
        logged.add(at);
        onLog?.(text, alert);
      }
    };

    // La foto "vola" dal volto al pannello centrale
    const to = photoEl.getBoundingClientRect();
    photoEl.animate(
      [
        {
          transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.w / to.width}, ${from.h / to.height})`,
        },
        { transform: 'none' },
      ],
      { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }
    );

    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const S = Math.round(canvas.clientWidth * dpr);
      if (canvas.width !== S) canvas.width = canvas.height = S;

      ctx.drawImage(snapshot, 0, 0, S, S);

      // Glitch: qualche fetta orizzontale spostata
      if (Math.random() < 0.12) {
        for (let i = 0; i < 3; i++) {
          const y = rand(0, S);
          const h = rand(2, 14) * dpr;
          ctx.drawImage(canvas, 0, y, S, h, rand(-12, 12) * dpr, y, S, h);
        }
      }

      // Griglia
      const gridA = Math.min(1, t / 0.6) * 0.14;
      ctx.strokeStyle = `rgba(255,40,40,${gridA})`;
      ctx.lineWidth = 1 * dpr;
      for (let i = 1; i < 12; i++) {
        const p = (i / 12) * S;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, S);
        ctx.moveTo(0, p);
        ctx.lineTo(S, p);
        ctx.stroke();
      }

      // Linea di scansione che scorre (due passate)
      if (t > 0.3 && t < 2.5) {
        const y = (((t - 0.3) / 1.1) % 1) * S;
        const band = ctx.createLinearGradient(0, y - S * 0.12, 0, y);
        band.addColorStop(0, 'rgba(255,0,0,0)');
        band.addColorStop(1, 'rgba(255,40,40,0.35)');
        ctx.fillStyle = band;
        ctx.fillRect(0, y - S * 0.12, S, S * 0.12);
        ctx.fillStyle = 'rgba(255,90,90,0.9)';
        ctx.fillRect(0, y, S, 2 * dpr);
      }

      // Collegamenti tra i punti, disegnati progressivamente
      const linkP = Math.min(1, Math.max(0, (t - 1.5) / 0.8));
      ctx.strokeStyle = 'rgba(255,60,60,0.75)';
      ctx.lineWidth = 1.2 * dpr;
      LINKS.forEach(([a, b], i) => {
        const p = Math.min(1, Math.max(0, linkP * LINKS.length - i));
        if (!p) return;
        const [ax, ay] = kps[a];
        const [bx, by] = kps[b];
        ctx.beginPath();
        ctx.moveTo(ax * S, ay * S);
        ctx.lineTo((ax + (bx - ax) * p) * S, (ay + (by - ay) * p) * S);
        ctx.stroke();
      });

      // Punti chiave: compaiono uno alla volta con un mirino che si stringe
      ctx.font = `${Math.round(S * 0.032)}px ui-monospace, Menlo, monospace`;
      kps.forEach(([x, y], i) => {
        const at = 0.6 + i * 0.16;
        if (t < at) return;
        const p = Math.min(1, (t - at) / 0.25);
        const r = S * (0.08 - 0.055 * p);
        const px = x * S;
        const py = y * S;
        ctx.strokeStyle = `rgba(255,50,50,${0.4 + 0.6 * p})`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.moveTo(px - r * 1.6, py);
        ctx.lineTo(px - r * 0.5, py);
        ctx.moveTo(px + r * 0.5, py);
        ctx.lineTo(px + r * 1.6, py);
        ctx.moveTo(px, py - r * 1.6);
        ctx.lineTo(px, py - r * 0.5);
        ctx.moveTo(px, py + r * 0.5);
        ctx.lineTo(px, py + r * 1.6);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,70,70,0.9)';
        ctx.fillText(KP_NAMES[i], px + r * 1.8, py - r * 0.8);
      });

      // Mirino che salta da un punto all'altro
      if (t > 1.2 && t < 2.9) {
        const [x, y] = kps[Math.floor((t - 1.2) / 0.28) % kps.length];
        const s = S * 0.16;
        ctx.strokeStyle = 'rgba(255,220,220,0.85)';
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect(x * S - s / 2, y * S - s / 2, s, s);
      }

      // Bordo che pulsa a verdetto emesso
      const pulse = t > VERDICT_AT ? 0.6 + 0.4 * Math.sin(t * 18) : 0.8;
      ctx.strokeStyle = `rgba(255,40,40,${pulse})`;
      ctx.lineWidth = 4 * dpr;
      ctx.strokeRect(0, 0, S, S);
    }

    const start = performance.now();
    let raf;
    function frame(now) {
      t = (now - start) / 1000;
      logAt(0, `SNAPSHOT TARGET ${id}`, true);
      logAt(0.8, 'EXTRACTING FACIAL VECTORS');
      logAt(1.6, 'QUERY DB_GLOBAL ... 4.2M RECORDS');
      logAt(VERDICT_AT, `${verdict} [${id}]`, true);
      draw();
      if (t >= DURATION) return onDone?.();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="analysis" style:opacity>
  <div class="panel">
    <div class="photo" bind:this={photoEl}>
      <canvas bind:this={canvas}></canvas>
    </div>

    <div class="data">
      <div class="title">{typed('FACIAL ANALYSIS', 0.1)}</div>
      <div class="bar"><div class="fill" style:width={`${progress * 100}%`}></div></div>
      <div class="pct">{progress < 1 ? `SCANNING ${Math.floor(progress * 100)}%` : 'COMPLETE'}</div>

      {#each fields as f}
        <div class="row">
          <span class="k">{t >= f.at ? f.label : ''}</span>
          <span class="v">{typed(f.value, f.at)}</span>
        </div>
      {/each}

      {#if t >= VERDICT_AT}
        <div class="verdict" class:on={Math.floor(t * 6) % 2 === 0}>{typed(verdict, VERDICT_AT)}</div>
      {/if}
    </div>
  </div>

  <div class="flash" style:opacity={flash}></div>
</div>

<style>
  .analysis {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.82);
    display: grid;
    place-items: center;
    pointer-events: none;
    color: #ff3a3a;
    text-shadow:
      -1px 0 rgba(255, 0, 0, 0.7),
      1px 0 rgba(0, 255, 255, 0.25);
  }

  .panel {
    display: flex;
    align-items: center;
    gap: 3vmin;
  }

  .photo {
    width: min(72vh, 46vw);
    aspect-ratio: 1;
    transform-origin: 0 0;
    box-shadow: 0 0 30px rgba(255, 0, 0, 0.35);
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .data {
    width: min(36vw, 320px);
    font-size: clamp(10px, 3vmin, 18px);
    letter-spacing: 0.08em;
    line-height: 1.6;
  }

  .title {
    font-weight: bold;
    font-size: 1.15em;
    min-height: 1.6em;
  }

  .bar {
    height: 0.6em;
    border: 1px solid #ff3a3a;
    margin: 0.4em 0 0.2em;
  }

  .fill {
    height: 100%;
    background: #ff3a3a;
    box-shadow: 0 0 8px #f00;
  }

  .pct {
    font-size: 0.8em;
    opacity: 0.8;
    margin-bottom: 0.6em;
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 1em;
    min-height: 1.6em;
  }

  .k {
    opacity: 0.7;
  }

  .v {
    font-weight: bold;
  }

  .verdict {
    margin-top: 0.8em;
    padding: 0.3em 0.5em;
    border: 2px solid #ff3a3a;
    font-weight: bold;
    text-align: center;
  }

  .verdict.on {
    background: #ff2020;
    color: #000;
    text-shadow: none;
  }

  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
  }
</style>
