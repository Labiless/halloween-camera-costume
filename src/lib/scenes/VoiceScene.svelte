<script>
  let canvas;
  let status = $state('INIZIALIZZAZIONE...');

  const damp = (cur, target, speed, dt) => cur + (target - cur) * (1 - Math.exp(-speed * dt));

  // Bande di frequenza della voce, in scala logaritmica
  const BANDS = 16;
  const F_MIN = 90;
  const F_MAX = 6000;
  // Ogni colonna è fatta di blocchi stile LED
  const SEGMENTS = 14;
  // Il rumore di fondo (musica, gente) viene "imparato" e sottratto:
  // sale lentamente, così una voce vicina al microfono emerge comunque.
  const FLOOR_RISE = 0.25;
  const FLOOR_FALL = 6;
  const GATE = 0.06;
  // Il suono più forte degli ultimi secondi vale "colonna piena": così sillabe forti e deboli
  // restano ben distinte. MIN_CEILING evita di amplificare il silenzio (più basso = più sensibile).
  const MIN_CEILING = 0.3;
  const CEILING_FALL = 0.4;
  // Contrasto tra bande: le frequenze sopra la media risaltano, le altre si abbassano (0 = spento)
  const CONTRAST = 0.5;
  // Espansione: >1 schiaccia i suoni deboli ed esalta quelli forti
  const EXPANSION = 1.7;
  // Gate sul volume assoluto: il microfono è attaccato alla bocca, quindi la mia voce
  // arriva molto più forte di quella degli altri. Sotto VOICE_DB la scena resta a riposo.
  // Per tarare la soglia apri la scena con ?debug nell'URL e guarda il valore in dB.
  const VOICE_DB = -32;
  const VOICE_HYSTERESIS = 4; // si richiude solo sotto VOICE_DB - questo valore
  const VOICE_HOLD = 0.25; // secondi in cui resta aperto dopo l'ultima sillaba
  const DEBUG = new URLSearchParams(location.search).has('debug');

  $effect(() => {
    const ctx = canvas.getContext('2d');
    const wf = document.createElement('canvas'); // spettrogramma che scorre
    const wctx = wf.getContext('2d');
    let W, H, dpr, raf, stream, audio, analyser, freq, wave, binHz;
    let stopped = false;

    const level = new Float32Array(BANDS); // livello mostrato (con attacco/rilascio)
    const peak = new Float32Array(BANDS); // picchi che ricadono lentamente
    const floor = new Float32Array(BANDS).fill(0.3);
    let ceiling = MIN_CEILING;
    let rmsDb = -100;
    let gateOpen = false;
    let gateHold = 0;
    let gateLevel = 0; // 0 = chiuso, 1 = aperto (sfumato)

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.width = wf.width = Math.round(innerWidth * dpr);
      H = canvas.height = wf.height = Math.round(innerHeight * dpr);
    }

    // Energia per banda in [0,1], al netto del rumore di fondo
    function readBands(dt, learn) {
      analyser.getFloatFrequencyData(freq);
      const raw = new Float32Array(BANDS);
      let max = 0;
      let mean = 0;
      for (let b = 0; b < BANDS; b++) {
        const f1 = F_MIN * Math.pow(F_MAX / F_MIN, b / BANDS);
        const f2 = F_MIN * Math.pow(F_MAX / F_MIN, (b + 1) / BANDS);
        const i1 = Math.max(1, Math.floor(f1 / binHz));
        const i2 = Math.max(i1 + 1, Math.ceil(f2 / binHz));
        let sum = 0;
        for (let i = i1; i < i2; i++) sum += freq[i];
        const db = sum / (i2 - i1);
        const v = Math.min(1, Math.max(0, (db + 95) / 65));

        floor[b] = damp(floor[b], v, v < floor[b] ? FLOOR_FALL : FLOOR_RISE, dt);
        raw[b] = Math.max(0, v - floor[b] - GATE);
        max = Math.max(max, raw[b]);
        mean += raw[b] / BANDS;
      }

      // Il tetto sale subito con un suono forte e scende piano (solo quando parlo io)
      if (learn) ceiling = max > ceiling ? max : damp(ceiling, Math.max(max, MIN_CEILING), CEILING_FALL, dt);

      const m = mean / ceiling;
      const out = new Float32Array(BANDS);
      for (let b = 0; b < BANDS; b++) {
        const c = Math.max(0, (raw[b] / ceiling - CONTRAST * m) / (1 - CONTRAST * m));
        out[b] = Math.min(1, Math.pow(c, EXPANSION));
      }
      return out;
    }

    function drawWaterfall(bands) {
      // Scorre verso sinistra e aggiunge una colonna a destra, simmetrica rispetto al centro
      const step = Math.max(1, Math.round(2 * dpr));
      wctx.globalCompositeOperation = 'copy';
      wctx.drawImage(wf, -step, 0);
      wctx.globalCompositeOperation = 'source-over';
      const bh = H / 2 / BANDS;
      for (let b = 0; b < BANDS; b++) {
        const v = bands[b];
        wctx.fillStyle = `rgba(255,${Math.round(10 + 70 * v * v)},${Math.round(10 + 30 * v * v)},${0.05 + v * 0.95})`;
        wctx.fillRect(W - step, H / 2 - (b + 1) * bh, step, bh + 0.5);
        wctx.fillRect(W - step, H / 2 + b * bh, step, bh + 0.5);
      }
    }

    function drawColumns(t) {
      // Colonne specchiate: basse frequenze al centro, alte verso i bordi
      const cols = BANDS * 2 - 1;
      const areaW = W * 0.8;
      const colW = areaW / cols;
      const gap = colW * 0.28;
      const maxH = H * 0.42;
      const segH = maxH / SEGMENTS;
      const segGap = segH * 0.3;
      const x0 = (W - areaW) / 2;

      for (let c = 0; c < cols; c++) {
        const b = Math.abs(c - (BANDS - 1));
        const v = level[b];
        // A riposo resta acceso un blocco che "respira"
        const idle = 0.35 + 0.2 * Math.sin(t * 2 + b * 0.5);
        const lit = Math.max(1, Math.round(v * SEGMENTS));
        const pk = Math.min(SEGMENTS - 1, Math.round(peak[b] * SEGMENTS));
        const x = x0 + c * colW + gap / 2;
        const w = colW - gap;

        for (let s = 0; s < SEGMENTS; s++) {
          const on = s < lit;
          const isPeak = s === pk && pk >= lit;
          if (!on && !isPeak) {
            // Blocco spento, appena visibile
            ctx.fillStyle = 'rgba(80,0,0,0.25)';
          } else {
            const hot = s / SEGMENTS;
            const a = v > 0.02 ? 1 : idle;
            ctx.fillStyle = isPeak
              ? 'rgba(255,150,130,0.7)'
              : `rgba(255,${Math.round(30 + 170 * hot * hot)},${Math.round(20 + 80 * hot * hot)},${a})`;
          }
          const dy = s * segH + segGap / 2;
          ctx.fillRect(x, H / 2 - dy - (segH - segGap), w, segH - segGap);
          ctx.fillRect(x, H / 2 + dy, w, segH - segGap);
        }

        // Alone luminoso attorno alla colonna accesa
        if (v > 0.02) {
          const h = lit * segH;
          const glow = ctx.createLinearGradient(0, H / 2 - h, 0, H / 2 + h);
          glow.addColorStop(0, 'rgba(255,0,0,0)');
          glow.addColorStop(0.5, `rgba(255,30,0,${0.35 * v})`);
          glow.addColorStop(1, 'rgba(255,0,0,0)');
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = glow;
          ctx.fillRect(x - gap, H / 2 - h * 1.3, w + gap * 2, h * 2.6);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    function drawScope(energy) {
      ctx.strokeStyle = `rgba(255,120,100,${0.15 + energy * 0.4})`;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      const n = wave.length;
      for (let i = 0; i < n; i += 2) {
        const x = (i / n) * W;
        const y = H / 2 + wave[i] * H * 0.35 * gateLevel;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }

    function drawBackground() {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.28;
      ctx.drawImage(wf, 0, 0);
      ctx.globalAlpha = 1;

      // Griglia leggera e linea centrale
      ctx.strokeStyle = 'rgba(255,40,40,0.06)';
      ctx.lineWidth = 1;
      const step = H / 8;
      ctx.beginPath();
      for (let y = step; y < H; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      for (let x = W / 2 % step; x < W; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      ctx.stroke();
    }

    function drawVignette() {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Volume complessivo in dB e apertura del gate, con isteresi e tenuta
    function updateGate(dt) {
      analyser.getFloatTimeDomainData(wave);
      let sum = 0;
      for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
      rmsDb = 10 * Math.log10(sum / wave.length + 1e-12);

      if (rmsDb > VOICE_DB) {
        gateOpen = true;
        gateHold = VOICE_HOLD;
      } else if (rmsDb < VOICE_DB - VOICE_HYSTERESIS) {
        gateHold -= dt;
        if (gateHold <= 0) gateOpen = false;
      }
      gateLevel = damp(gateLevel, gateOpen ? 1 : 0, gateOpen ? 40 : 10, dt);
    }

    function drawDebug() {
      const fs = Math.round(14 * dpr);
      const x = 16 * dpr;
      const y = H - 20 * dpr;
      const bw = 220 * dpr;
      const toX = (db) => x + Math.min(1, Math.max(0, (db + 80) / 80)) * bw;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y, bw, 8 * dpr);
      ctx.fillStyle = gateOpen ? '#3f3' : '#f44';
      ctx.fillRect(x, y, toX(rmsDb) - x, 8 * dpr);
      ctx.fillStyle = '#fff';
      ctx.fillRect(toX(VOICE_DB), y - 4 * dpr, 2 * dpr, 16 * dpr);
      ctx.font = `${fs}px ui-monospace, Menlo, monospace`;
      ctx.fillText(`${rmsDb.toFixed(1)} dB   soglia ${VOICE_DB} dB   ${gateOpen ? 'APERTO' : 'chiuso'}`, x, y - 10 * dpr);
    }

    let last = performance.now();
    function frame(now) {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      drawBackground();
      if (analyser) {
        updateGate(dt);
        const bands = readBands(dt, gateOpen).map((v) => v * gateLevel);
        let energy = 0;
        for (let b = 0; b < BANDS; b++) {
          // Attacco rapido, rilascio più lento: la voce "scatta" e poi si spegne morbida
          level[b] = damp(level[b], bands[b], bands[b] > level[b] ? 40 : 16, dt);
          peak[b] = Math.max(level[b], peak[b] - dt * 0.6);
          energy += level[b] / BANDS;
        }
        drawWaterfall(bands);
        drawScope(energy);
      }
      drawColumns(t);
      drawVignette();
      if (DEBUG && analyser) drawDebug();
      raf = requestAnimationFrame(frame);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Niente filtri del telefono: vogliamo il segnale grezzo della voce
          // (il controllo automatico del guadagno appiattirebbe le differenze di volume)
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        audio = new AudioContext();
        const src = audio.createMediaStreamSource(stream);
        analyser = audio.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.15; // poca media nel tempo: reagisce a ogni sillaba
        src.connect(analyser); // non collegato all'uscita: niente feedback
        freq = new Float32Array(analyser.frequencyBinCount);
        wave = new Float32Array(analyser.fftSize);
        binHz = audio.sampleRate / analyser.fftSize;
        await resumeAudio();
      } catch (err) {
        status = `MICROFONO NON DISPONIBILE\n${err.name}`;
      }
    }

    // Il browser può tenere l'audio sospeso finché non c'è un'interazione
    async function resumeAudio() {
      if (audio?.state === 'suspended') await audio.resume().catch(() => {});
      status = audio?.state === 'running' ? '' : 'TOCCA LO SCHERMO PER ATTIVARE IL MICROFONO';
    }
    window.addEventListener('pointerdown', resumeAudio);

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', resumeAudio);
      stream?.getTracks().forEach((t) => t.stop());
      audio?.close();
    };
  });
</script>

<canvas bind:this={canvas}></canvas>
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
  }

  .status {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 8vh;
    text-align: center;
    white-space: pre-line;
    color: #ff3a3a;
    text-shadow: 0 0 8px #f00;
    font-size: clamp(12px, 3.5vmin, 24px);
    letter-spacing: 0.15em;
    animation: blink 1s steps(1) infinite;
  }

  @keyframes blink {
    50% { opacity: 0.3; }
  }
</style>
