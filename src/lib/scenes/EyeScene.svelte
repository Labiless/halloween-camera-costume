<script>
  import { gaze } from '../gaze.svelte.js';

  let canvas;

  const rand = (a, b) => a + Math.random() * (b - a);
  const damp = (cur, target, speed, dt) => cur + (target - cur) * (1 - Math.exp(-speed * dt));

  $effect(() => {
    const ctx = canvas.getContext('2d');
    let W, H, dpr, cx, cy, R; // R = raggio della lente
    let housing, lensBg, glass, iris; // layer statici pre-renderizzati
    let raf;

    // ---------- Stato dell'occhio ----------
    const eye = {
      x: 0, y: 0, // posizione attuale dello sguardo [-1, 1]
      tx: 0, ty: 0, // obiettivo
      pupil: 0.4, pupilTarget: 0.4, // 0 = fessura sottile, 1 = dilatata
      zoom: 1, zoomTarget: 1, // "messa a fuoco" della camera
      shutter: 0, // 0 = aperto, 1 = diaframma chiuso (palpebra)
      squint: 0, squintTarget: 0, // diaframma socchiuso, sguardo cattivo
      nextSaccade: 0,
      nextPupil: 0,
      nextBlink: 0,
      blinkStart: -1,
      blinkCount: 0,
      glitchUntil: 0,
      nextGlitch: 0,
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
      R = (Math.min(W, H) / 2) * 0.68;
      housing = drawHousing();
      lensBg = drawLensBg();
      glass = drawGlass();
      iris = drawIris();
    }

    function drawHousing() {
      const c = makeLayer(W, H);
      const g = c.getContext('2d');
      g.translate(cx, cy);

      // Corpo esterno
      const body = g.createRadialGradient(-R * 0.4, -R * 0.4, R * 0.2, 0, 0, R * 1.45);
      body.addColorStop(0, '#2a2a2c');
      body.addColorStop(0.7, '#121213');
      body.addColorStop(1, '#050505');
      g.fillStyle = body;
      g.beginPath();
      g.arc(0, 0, R * 1.42, 0, Math.PI * 2);
      g.fill();

      // Zigrinatura della ghiera
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 1.5 * dpr;
      for (let i = 0; i < 180; i++) {
        const a = (i / 180) * Math.PI * 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * R * 1.34, Math.sin(a) * R * 1.34);
        g.lineTo(Math.cos(a) * R * 1.41, Math.sin(a) * R * 1.41);
        g.stroke();
      }

      // Anello metallico
      let metal;
      if (g.createConicGradient) {
        metal = g.createConicGradient(-Math.PI / 4, 0, 0);
        const stops = ['#555', '#1a1a1a', '#8a8a8a', '#222', '#4a4a4a', '#151515', '#7a7a7a', '#2a2a2a', '#555'];
        stops.forEach((s, i) => metal.addColorStop(i / (stops.length - 1), s));
      } else {
        metal = g.createLinearGradient(-R, -R, R, R);
        metal.addColorStop(0, '#777');
        metal.addColorStop(0.5, '#1a1a1a');
        metal.addColorStop(1, '#555');
      }
      g.fillStyle = metal;
      g.beginPath();
      g.arc(0, 0, R * 1.16, 0, Math.PI * 2);
      g.arc(0, 0, R * 1.02, 0, Math.PI * 2, true);
      g.fill();

      // Bordi dell'anello
      g.lineWidth = 2 * dpr;
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      for (const r of [1.02, 1.16]) {
        g.beginPath();
        g.arc(0, 0, R * r, 0, Math.PI * 2);
        g.stroke();
      }

      // Scritte sulla ghiera
      const text = 'CCTV  ·  1:1.4  f=8mm  ·  Ø46  ·  IR-CUT  ·  NIGHT VISION  ·  SN 666-0013  ·  ';
      g.font = `${Math.round(R * 0.055)}px ui-monospace, Menlo, monospace`;
      g.fillStyle = 'rgba(220,220,220,0.55)';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const chars = [...text];
      for (let i = 0; i < chars.length; i++) {
        const a = -Math.PI / 2 + (i / chars.length) * Math.PI * 2;
        g.save();
        g.rotate(a);
        g.translate(0, -R * 1.09);
        g.fillText(chars[i], 0, 0);
        g.restore();
      }

      // Viti
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const sx = Math.cos(a) * R * 1.3;
        const sy = Math.sin(a) * R * 1.3;
        const sg = g.createRadialGradient(sx - R * 0.01, sy - R * 0.01, 0, sx, sy, R * 0.035);
        sg.addColorStop(0, '#888');
        sg.addColorStop(1, '#111');
        g.fillStyle = sg;
        g.beginPath();
        g.arc(sx, sy, R * 0.032, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#0a0a0a';
        g.lineWidth = 1.5 * dpr;
        g.beginPath();
        g.moveTo(sx - R * 0.02, sy);
        g.lineTo(sx + R * 0.02, sy);
        g.stroke();
      }
      return c;
    }

    function drawLensBg() {
      const S = Math.ceil(R * 2);
      const c = makeLayer(S, S);
      const g = c.getContext('2d');
      g.translate(S / 2, S / 2);

      const bg = g.createRadialGradient(0, 0, 0, 0, 0, R);
      bg.addColorStop(0, '#0a0507');
      bg.addColorStop(0.6, '#050608');
      bg.addColorStop(1, '#010102');
      g.fillStyle = bg;
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.fill();

      // Anelli interni del barilotto, danno profondità
      for (const [r, a] of [[0.97, 0.08], [0.9, 0.05], [0.82, 0.04], [0.74, 0.03]]) {
        g.strokeStyle = `rgba(160,170,190,${a})`;
        g.lineWidth = R * 0.012;
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

      // Ombra interna sul bordo del vetro
      const edge = g.createRadialGradient(0, 0, R * 0.7, 0, 0, R);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(0,0,0,0.85)');
      g.fillStyle = edge;
      g.fillRect(-R, -R, R * 2, R * 2);

      // Riflesso morbido in alto a sinistra
      const soft = g.createRadialGradient(-R * 0.35, -R * 0.4, 0, -R * 0.35, -R * 0.4, R * 0.7);
      soft.addColorStop(0, 'rgba(255,255,255,0.10)');
      soft.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = soft;
      g.fillRect(-R, -R, R * 2, R * 2);

      // Arco di luce
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = R * 0.05;
      g.filter = `blur(${R * 0.012}px)`;
      g.beginPath();
      g.arc(0, 0, R * 0.84, Math.PI * 1.08, Math.PI * 1.42);
      g.stroke();
      g.filter = 'none';

      // Riflessi colorati del trattamento antiriflesso
      g.lineWidth = R * 0.03;
      g.strokeStyle = 'rgba(140,80,255,0.12)';
      g.beginPath();
      g.arc(0, 0, R * 0.7, Math.PI * 0.1, Math.PI * 0.4);
      g.stroke();
      g.strokeStyle = 'rgba(60,255,160,0.08)';
      g.beginPath();
      g.arc(0, 0, R * 0.6, Math.PI * 0.15, Math.PI * 0.35);
      g.stroke();

      // Punto luce
      const dot = g.createRadialGradient(-R * 0.42, -R * 0.5, 0, -R * 0.42, -R * 0.5, R * 0.06);
      dot.addColorStop(0, 'rgba(255,255,255,0.85)');
      dot.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = dot;
      g.beginPath();
      g.arc(-R * 0.42, -R * 0.5, R * 0.06, 0, Math.PI * 2);
      g.fill();
      return c;
    }

    function drawIris() {
      const Ri = R * 0.52;
      const S = Math.ceil(Ri * 2);
      const c = makeLayer(S, S);
      const g = c.getContext('2d');
      g.translate(S / 2, S / 2);

      const base = g.createRadialGradient(0, 0, 0, 0, 0, Ri);
      base.addColorStop(0, '#ffe066');
      base.addColorStop(0.14, '#ff8a1a');
      base.addColorStop(0.38, '#e01208');
      base.addColorStop(0.72, '#7a0000');
      base.addColorStop(0.9, '#2a0000');
      base.addColorStop(1, '#000');
      g.fillStyle = base;
      g.beginPath();
      g.arc(0, 0, Ri, 0, Math.PI * 2);
      g.fill();

      g.save();
      g.clip();

      // Fibre radiali
      g.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const a = rand(0, Math.PI * 2);
        const r1 = Ri * rand(0.12, 0.3);
        const r2 = Ri * rand(0.55, 0.98);
        const bend = rand(-0.12, 0.12);
        const dark = Math.random() < 0.35;
        g.strokeStyle = dark
          ? `rgba(20,0,0,${rand(0.2, 0.5)})`
          : `rgba(255,${Math.round(rand(110, 200))},${Math.round(rand(30, 80))},${rand(0.08, 0.3)})`;
        g.lineWidth = rand(0.5, 2.2) * dpr;
        const mid = (r1 + r2) / 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        g.quadraticCurveTo(Math.cos(a + bend) * mid, Math.sin(a + bend) * mid, Math.cos(a) * r2, Math.sin(a) * r2);
        g.stroke();
      }

      // Cripte (macchie scure)
      for (let i = 0; i < 40; i++) {
        const a = rand(0, Math.PI * 2);
        const r = Ri * rand(0.35, 0.8);
        g.fillStyle = `rgba(30,0,0,${rand(0.2, 0.5)})`;
        g.beginPath();
        g.ellipse(Math.cos(a) * r, Math.sin(a) * r, Ri * rand(0.015, 0.04), Ri * rand(0.04, 0.09), a, 0, Math.PI * 2);
        g.fill();
      }

      // Collaretto ondulato
      g.strokeStyle = 'rgba(255,170,60,0.35)';
      g.lineWidth = 1.5 * dpr;
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        const r = Ri * (0.34 + Math.sin(a * 9) * 0.02 + Math.sin(a * 23) * 0.012);
        i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.stroke();

      // Anello limbare scuro
      g.strokeStyle = 'rgba(0,0,0,0.9)';
      g.lineWidth = Ri * 0.1;
      g.filter = `blur(${Ri * 0.02}px)`;
      g.beginPath();
      g.arc(0, 0, Ri * 0.97, 0, Math.PI * 2);
      g.stroke();
      g.filter = 'none';
      g.restore();
      return c;
    }

    // ---------- Comportamento ----------
    function update(t, dt) {
      if (gaze.manual) {
        eye.tx = gaze.x;
        eye.ty = gaze.y;
      } else if (t > eye.nextSaccade) {
        // Saccade: scatto verso un nuovo punto, ogni tanto torna a fissare il centro
        if (Math.random() < 0.3) {
          eye.tx = rand(-0.08, 0.08);
          eye.ty = rand(-0.08, 0.08);
          eye.zoomTarget = 1.12; // "ti ho visto": mette a fuoco
          eye.squintTarget = Math.random() < 0.6 ? 0.28 : 0;
          eye.pupilTarget = 0.1;
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
        eye.pupilTarget = rand(0.15, 0.85);
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

      // Glitch occasionale del segnale
      if (t > eye.nextGlitch) {
        eye.glitchUntil = t + rand(0.08, 0.3);
        eye.nextGlitch = t + rand(5, 14);
      }
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
        g.addColorStop(0, `rgb(${58 + shade},${58 + shade},${66 + shade})`);
        g.addColorStop(1, '#0c0c0f');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      }
      // Filo di luce sul bordo interno di ogni lamella
      ctx.strokeStyle = 'rgba(200,200,215,0.35)';
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
      const Ri = R * 0.52;
      const maxOff = R * 0.36;
      const ox = eye.x * maxOff;
      const oy = eye.y * maxOff;
      const d = Math.min(1, Math.hypot(eye.x, eye.y));
      const ang = Math.atan2(eye.y, eye.x);

      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      // Prospettiva: l'iride si schiaccia nella direzione in cui guarda
      ctx.rotate(ang);
      ctx.scale(1 - 0.22 * d, 1);
      ctx.rotate(-ang);
      ctx.scale(eye.zoom, eye.zoom);

      // Bagliore rosso
      const pulse = 0.75 + Math.sin(t * 2.2) * 0.15 + Math.sin(t * 7.3) * 0.05;
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(0, 0, Ri * 0.6, 0, 0, Ri * 1.7);
      glow.addColorStop(0, `rgba(255,20,0,${0.35 * pulse})`);
      glow.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, Ri * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Iride (rotazione lenta, inquietante)
      ctx.save();
      ctx.rotate(t * 0.05);
      ctx.drawImage(iris, -iris.width / 2, -iris.height / 2);
      ctx.restore();

      // Pupilla a fessura
      const pw = Ri * (0.07 + 0.3 * eye.pupil);
      const ph = Ri * (0.66 + 0.16 * eye.pupil);
      ctx.save();
      ctx.shadowColor = 'rgba(255,90,0,0.9)';
      ctx.shadowBlur = Ri * 0.12;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 0, pw, ph, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Bagliore "sensore" in fondo alla pupilla
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, pw * 0.8);
      core.addColorStop(0, `rgba(255,30,30,${0.35 * pulse})`);
      core.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.ellipse(0, 0, pw * 0.8, ph * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawIrLeds(t) {
      // Anello di LED infrarossi attorno alla lente, rosso spento che pulsa
      const N = 16;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + Math.PI / N;
        const x = cx + Math.cos(a) * R * 1.25;
        const y = cy + Math.sin(a) * R * 1.25;
        const k = 0.35 + 0.25 * Math.sin(t * 1.6 + i * 0.4);
        const lg = ctx.createRadialGradient(x, y, 0, x, y, R * 0.06);
        lg.addColorStop(0, `rgba(255,60,40,${k})`);
        lg.addColorStop(0.35, `rgba(120,0,0,${k * 0.8})`);
        lg.addColorStop(1, 'rgba(60,0,0,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(x, y, R * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function glitch() {
      const slices = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < slices; i++) {
        const y = Math.random() * H;
        const h = rand(4, 40) * dpr;
        const dx = rand(-1, 1) * 40 * dpr;
        ctx.drawImage(canvas, 0, y, W, h, dx, y, W, h);
      }
      // Separazione cromatica
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25;
      ctx.drawImage(canvas, rand(4, 10) * dpr, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function render(t) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(housing, 0, 0);
      drawIrLeds(t);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(lensBg, cx - lensBg.width / 2, cy - lensBg.height / 2);
      drawEye(t);
      drawAperture(eye.shutter);
      ctx.drawImage(glass, cx - glass.width / 2, cy - glass.height / 2);
      ctx.restore();

      // Leggero sfarfallio di luminosità
      if (Math.random() < 0.04) {
        ctx.fillStyle = `rgba(0,0,0,${rand(0.05, 0.2)})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (t < eye.glitchUntil) glitch();
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

    const t0 = last / 1000;
    eye.nextBlink = t0 + rand(2, 4);
    eye.nextGlitch = t0 + rand(3, 6);

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
