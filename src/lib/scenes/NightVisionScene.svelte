<script>
  import { getFaceDetector } from '../faceDetector.js';
  import FakeLog from '../FakeLog.svelte';
  import FaceAnalysis from '../FaceAnalysis.svelte';
  import { onButton, BUTTONS } from '../controller.svelte.js';

  let gl_canvas;
  let overlay;
  let video;
  let log;
  let status = $state('INIZIALIZZAZIONE...');
  let analysis = $state(null); // foto del volto in analisi

  const rand = (a, b) => a + Math.random() * (b - a);
  const damp = (cur, target, speed, dt) => cur + (target - cur) * (1 - Math.exp(-speed * dt));

  const MAX_FACES = 8;

  // ---------- Shader night vision ----------
  const VERT = `
    attribute vec2 p;
    varying vec2 v_uv;
    void main() {
      v_uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); // (0,0) = in alto a sinistra
      gl_Position = vec4(p, 0.0, 1.0);
    }`;

  const FRAG = `
    precision mediump float;
    uniform sampler2D u_tex;
    uniform vec2 u_scale;   // adattamento "cover" del video allo schermo
    uniform vec2 u_texel;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_gain;   // guadagno automatico, alza le immagini buie
    uniform vec4 u_faces[${MAX_FACES}]; // riquadri dei volti in coordinate schermo [0,1]: x, y, w, h
    uniform float u_faceAlpha[${MAX_FACES}];
    varying vec2 v_uv;

    // 1 dentro i riquadri dei volti (bordo sfumato), 0 fuori
    float faceMask() {
      float m = 0.0;
      for (int i = 0; i < ${MAX_FACES}; i++) {
        vec4 f = u_faces[i];
        vec2 e = f.zw * 0.12;
        vec2 inside = smoothstep(f.xy - e, f.xy + e, v_uv) * (1.0 - smoothstep(f.xy + f.zw - e, f.xy + f.zw + e, v_uv));
        m = max(m, inside.x * inside.y * u_faceAlpha[i]);
      }
      return m;
    }

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float luma(vec2 uv) { return dot(texture2D(u_tex, uv).rgb, vec3(0.299, 0.587, 0.114)); }

    void main() {
      vec2 uv = (v_uv - 0.5) * u_scale + 0.5;
      uv.x = 1.0 - uv.x; // specchiato, come un selfie

      float l = luma(uv);
      // Alone attorno alle zone chiare, tipico dei visori notturni
      vec2 o = u_texel * 3.0;
      float halo = (luma(uv + vec2(o.x, 0.0)) + luma(uv - vec2(o.x, 0.0)) +
                    luma(uv + vec2(0.0, o.y)) + luma(uv - vec2(0.0, o.y))) * 0.25;

      l = l * u_gain;
      l = pow(clamp(l, 0.0, 1.0), 0.85);
      l += max(0.0, halo * u_gain - 0.6) * 0.8;

      // I volti agganciati risaltano più luminosi del resto
      float fm = faceMask();
      l = mix(l, pow(l, 0.6) * 1.5 + 0.06, fm);

      // Grana del sensore
      float n = hash(floor(gl_FragCoord.xy / 2.0) + fract(u_time * 13.0) * 97.0) - 0.5;
      l += n * 0.16;

      // Scanline e lieve sfarfallio
      float scan = 0.88 + 0.12 * sin(gl_FragCoord.y * 1.6);
      float flicker = 0.96 + 0.04 * sin(u_time * 50.0);

      // Vignettatura circolare da cannocchiale
      vec2 d = v_uv - 0.5;
      d.x *= u_res.x / u_res.y;
      float vig = smoothstep(0.95, 0.35, length(d));

      vec3 col = vec3(0.35, 1.0, 0.4) * l * scan * flicker * vig + vec3(0.0, 0.025, 0.0);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function createGl(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false });
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const u = (name) => gl.getUniformLocation(prog, name);
    return {
      gl,
      uScale: u('u_scale'),
      uTexel: u('u_texel'),
      uRes: u('u_res'),
      uTime: u('u_time'),
      uGain: u('u_gain'),
      uFaces: u('u_faces'),
      uFaceAlpha: u('u_faceAlpha'),
    };
  }

  $effect(() => {
    let raf;
    let stream;
    let detector;
    let stopped = false;
    let W, H, dpr;
    const g = createGl(gl_canvas);
    const ctx = overlay.getContext('2d');

    // Misura della luminosità media per il guadagno automatico
    const probe = document.createElement('canvas');
    probe.width = probe.height = 16;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    let gain = 2;
    let nextProbe = 0;

    // Volti tracciati: ognuno mantiene il suo numero finché resta in scena
    let tracks = [];
    let lastVideoTime = -1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.round(innerWidth * dpr);
      H = Math.round(innerHeight * dpr);
      gl_canvas.width = overlay.width = W;
      gl_canvas.height = overlay.height = H;
      g.gl.viewport(0, 0, W, H);
    }

    // Scala "cover": quale porzione del video è visibile sullo schermo
    function coverScale() {
      const va = video.videoWidth / video.videoHeight;
      const sa = W / H;
      return va > sa ? [sa / va, 1] : [1, va / sa];
    }

    // Da rilevamento nel video a riquadro + punti chiave in pixel dello schermo (con specchio)
    function toScreen({ boundingBox: box, keypoints }, [sx, sy]) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const mapX = (u) => ((1 - u - 0.5) / sx + 0.5) * W;
      const mapY = (v) => ((v - 0.5) / sy + 0.5) * H;
      const x1 = mapX((box.originX + box.width) / vw);
      const x2 = mapX(box.originX / vw);
      const y1 = mapY(box.originY / vh);
      const y2 = mapY((box.originY + box.height) / vh);
      const kp = (keypoints ?? []).map((k) => [mapX(k.x), mapY(k.y)]);
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, kp };
    }

    function updateTracks(boxes, now, dt) {
      const used = new Set();
      for (const b of boxes) {
        const bx = b.x + b.w / 2;
        const by = b.y + b.h / 2;
        let best = null;
        let bestDist = Math.max(b.w, b.h) * 0.9;
        for (const t of tracks) {
          if (used.has(t)) continue;
          const dist = Math.hypot(t.x + t.w / 2 - bx, t.y + t.h / 2 - by);
          if (dist < bestDist) {
            best = t;
            bestDist = dist;
          }
        }
        if (best) {
          used.add(best);
          best.x = damp(best.x, b.x, 20, dt);
          best.y = damp(best.y, b.y, 20, dt);
          best.w = damp(best.w, b.w, 20, dt);
          best.h = damp(best.h, b.h, 20, dt);
          best.kp = b.kp;
          best.lastSeen = now;
        } else {
          const t = { ...b, id: String(Math.floor(rand(0, 10000))).padStart(4, '0'), born: now, lastSeen: now };
          tracks.push(t);
          used.add(t);
          log?.push(`>> TARGET ${t.id} ACQUIRED`, true);
        }
      }
      tracks = tracks.filter((t) => {
        const alive = now - t.lastSeen < 400;
        if (!alive) log?.push(`<< TARGET ${t.id} LOST`);
        return alive;
      });
    }

    // Riquadro disegnato (un po' più largo del volto rilevato) e opacità, con dissolvenza in uscita
    function frameOf(t, now) {
      const missing = now - t.lastSeen;
      const alpha = missing > 150 ? Math.max(0, 1 - (missing - 150) / 250) : 1;
      const pad = t.w * 0.12;
      return { x: t.x - pad, y: t.y - pad * 1.4, w: t.w + pad * 2, h: t.h + pad * 2.2, alpha };
    }

    const faceRects = new Float32Array(MAX_FACES * 4);
    const faceAlphas = new Float32Array(MAX_FACES);
    function uploadFaces(now) {
      faceRects.fill(0);
      faceAlphas.fill(0);
      tracks.slice(0, MAX_FACES).forEach((t, i) => {
        const f = frameOf(t, now);
        faceRects.set([f.x / W, f.y / H, f.w / W, f.h / H], i * 4);
        faceAlphas[i] = f.alpha;
      });
      g.gl.uniform4fv(g.uFaces, faceRects);
      g.gl.uniform1fv(g.uFaceAlpha, faceAlphas);
    }

    function drawTracks(now) {
      ctx.clearRect(0, 0, W, H);
      const font = Math.round(Math.max(14, H * 0.035));
      ctx.font = `bold ${font}px ui-monospace, Menlo, monospace`;
      ctx.textBaseline = 'bottom';
      for (const t of tracks) {
        const { x, y, w, h, alpha } = frameOf(t, now);
        // Lampeggio all'aggancio di un nuovo volto
        const age = now - t.born;
        const lockBlink = age < 400 && Math.floor(age / 80) % 2 === 1 ? 0.3 : 1;
        ctx.globalAlpha = alpha * lockBlink;

        ctx.strokeStyle = '#ff2a2a';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 8 * dpr;
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect(x, y, w, h);

        // Etichetta col numero sopra il riquadro
        const label = t.id;
        const tw = ctx.measureText(label).width;
        const lp = font * 0.3;
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ff2a2a';
        ctx.fillRect(x - ctx.lineWidth / 2, y - font - lp * 2, tw + lp * 2, font + lp * 2);
        ctx.fillStyle = '#000';
        ctx.fillText(label, x + lp, y - lp * 0.6);
      }
      ctx.globalAlpha = 1;
    }

    function autoGain(now) {
      if (now < nextProbe) return;
      nextProbe = now + 250;
      pctx.drawImage(video, 0, 0, 16, 16);
      const d = pctx.getImageData(0, 0, 16, 16).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const mean = sum / (d.length / 4) / 255;
      const target = Math.min(6, Math.max(1, 0.42 / Math.max(mean, 0.01)));
      gain = damp(gain, target, 2, 0.25);
    }

    let last = performance.now();
    function frame(now) {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (video.readyState >= 2) {
        const scale = coverScale();
        autoGain(now);

        if (detector && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const result = detector.detectForVideo(video, now);
          updateTracks(result.detections.map((d) => toScreen(d, scale)), now, dt);
        }

        const { gl } = g;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        gl.uniform2f(g.uScale, scale[0], scale[1]);
        gl.uniform2f(g.uTexel, 1 / video.videoWidth, 1 / video.videoHeight);
        gl.uniform2f(g.uRes, W, H);
        gl.uniform1f(g.uTime, now / 1000);
        gl.uniform1f(g.uGain, gain);
        uploadFaces(now);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // La foto va presa subito dopo il disegno: il canvas WebGL non conserva il frame
        if (snapRequested) {
          snapRequested = false;
          takeSnapshot(now);
        }

        drawTracks(now);
      }
      raf = requestAnimationFrame(frame);
    }

    // Foto del volto più vicino (riquadro più grande), presa dall'immagine night vision
    let snapRequested = false;
    function takeSnapshot(now) {
      const visible = tracks.filter((t) => now - t.lastSeen < 150);
      if (!visible.length) return log?.push('NO TARGET IN RANGE', true);
      const t = visible.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));

      const side = Math.max(t.w, t.h) * 1.5;
      const sx = t.x + t.w / 2 - side / 2;
      const sy = t.y + t.h / 2 - side / 2;
      const snap = document.createElement('canvas');
      snap.width = snap.height = 512;
      snap.getContext('2d').drawImage(gl_canvas, sx, sy, side, side, 0, 0, 512, 512);

      analysis = {
        snapshot: snap,
        keypoints: t.kp?.map(([x, y]) => [(x - sx) / side, (y - sy) / side]),
        id: t.id,
        from: { x: sx / dpr, y: sy / dpr, w: side / dpr, h: side / dpr },
      };
    }
    const offButton = onButton((b) => {
      if (b === BUTTONS.ACTION && !analysis) snapRequested = true;
    });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        video.srcObject = stream;
        await video.play();
        status = '';
      } catch (err) {
        status = `CAMERA NON DISPONIBILE\n${err.name}`;
        return;
      }
      try {
        detector = await getFaceDetector();
      } catch (err) {
        console.error(err);
        status = 'RICONOSCIMENTO VOLTI NON DISPONIBILE';
      }
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    start();

    return () => {
      stopped = true;
      offButton();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      stream?.getTracks().forEach((t) => t.stop());
      g.gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  });
</script>

<!-- svelte-ignore a11y_media_has_caption -->
<video bind:this={video} playsinline muted></video>
<canvas bind:this={gl_canvas}></canvas>
<canvas bind:this={overlay}></canvas>
<FakeLog bind:this={log} />
{#if analysis}
  <FaceAnalysis {...analysis} onLog={(text, alert) => log?.push(text, alert)} onDone={() => (analysis = null)} />
{/if}
{#if status}
  <div class="status">{status}</div>
{/if}

<style>
  /* Non display:none: su iOS un video nascosto smette di aggiornare i frame */
  video {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .status {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    text-align: center;
    white-space: pre-line;
    color: #7dff7d;
    text-shadow: 0 0 8px #3f3;
    font-size: clamp(14px, 4vmin, 28px);
    letter-spacing: 0.15em;
    animation: blink 1s steps(1) infinite;
  }

  @keyframes blink {
    50% { opacity: 0.3; }
  }
</style>
