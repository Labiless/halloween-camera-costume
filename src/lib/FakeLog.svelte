<script>
  // Log finti che scorrono all'infinito, rossi e glitchati, in sovraimpressione.
  // push(text) permette alla scena di inserire eventi veri (es. volti agganciati).
  const MAX_LINES = 26;
  const GLYPHS = '█▓▒░#@$%&*!?/\\|<>01ØΣΔ';

  const rand = (a, b) => a + Math.random() * (b - a);
  const int = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hex = (n) => Array.from({ length: n }, () => int(0, 15).toString(16)).join('').toUpperCase();
  const t0 = performance.now();

  function stamp() {
    const ms = Math.floor(performance.now() - t0) + 7_340_000;
    const pad = (v, n = 2) => String(v).padStart(n, '0');
    return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
  }

  const TEMPLATES = [
    () => `SCAN SECTOR ${hex(2)}:${hex(2)} ... OK`,
    () => `IR GAIN ${rand(18, 42).toFixed(1)}dB  EXP ${int(8, 66)}ms`,
    () => `BIOMETRIC HASH 0x${hex(8)}`,
    () => `UPLINK PKT#${int(1000, 99999)} >> NODE_${hex(3)}`,
    () => `THERMAL ${rand(35.9, 37.4).toFixed(1)}°C  Δ${rand(-0.3, 0.3).toFixed(2)}`,
    () => `MATCH DB_${hex(4)} ... ${rand(0, 100).toFixed(2)}%`,
    () => `FRAME ${int(10000, 99999)} DROPPED`,
    () => `SYNC ${hex(4)}-${hex(4)}-${hex(4)}`,
    () => `RETINA SAMPLE ${int(1, 64)}/64`,
    () => `VOICEPRINT ${pick(['PENDING', 'STORED', 'PARTIAL'])}`,
    () => `TRACE ROUTE 10.${int(0, 255)}.${int(0, 255)}.${int(0, 255)}`,
    () => `MEM 0x${hex(8)} ${pick(['OK', 'OK', 'OK', 'CORRUPTED'])}`,
  ];
  // Righe inquietanti, rare
  const CREEPY = [
    'ERR: SOUL_NOT_FOUND',
    'SUBJECT IS AWARE OF OBSERVATION',
    'I SEE YOU',
    'DO NOT LOOK AT THE CAMERA',
    'WARN: SUBJECT NOT HUMAN?',
    'HOST UNREACHABLE ... HOST IS BEHIND YOU',
    'DELETING MEMORIES ... 13%',
  ];

  let nextId = 0;
  let lines = $state([]);

  export function push(text, alert = false) {
    lines.push({ id: nextId++, text: `[${stamp()}] ${text}`, alert, scramble: 0 });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  }

  function scrambled(text, amount) {
    if (!amount) return text;
    return [...text].map((c) => (c !== ' ' && Math.random() < amount ? pick(GLYPHS) : c)).join('');
  }

  let shift = $state(0);

  $effect(() => {
    let timer;
    const tick = () => {
      if (Math.random() < 0.06) push(pick(CREEPY), true);
      else push(pick(TEMPLATES)());
      // Ogni tanto una raffica veloce
      timer = setTimeout(tick, Math.random() < 0.15 ? rand(30, 80) : rand(180, 700));
    };
    // Avvio asincrono: push() dentro l'effect lo farebbe dipendere da `lines` e ripartire all'infinito
    timer = setTimeout(tick, 0);

    // Glitch: caratteri che si corrompono per un attimo e scatti orizzontali
    const glitch = setInterval(() => {
      for (const l of lines) l.scramble = 0;
      if (Math.random() < 0.35 && lines.length) pick(lines).scramble = rand(0.15, 0.6);
      shift = Math.random() < 0.08 ? rand(-6, 6) : 0;
    }, 110);

    return () => {
      clearTimeout(timer);
      clearInterval(glitch);
    };
  });
</script>

<div class="log" style:transform={`translateX(${shift}px)`}>
  {#each lines as line (line.id)}
    <div class="line" class:alert={line.alert} class:glitch={line.scramble > 0}>
      {scrambled(line.text, line.scramble)}
    </div>
  {/each}
</div>

<style>
  .log {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 34%;
    padding: 2vmin 2.5vmin;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;
    pointer-events: none;
    font-size: clamp(8px, 2.3vmin, 13px);
    line-height: 1.35;
    color: #ff2a2a;
    opacity: 0.55;
    text-shadow:
      1px 0 rgba(0, 255, 255, 0.25),
      -1px 0 rgba(255, 0, 0, 0.6),
      0 0 4px rgba(255, 0, 0, 0.5);
    /* Le righe più vecchie svaniscono verso l'alto */
    mask-image: linear-gradient(to bottom, transparent 0%, black 45%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 45%);
  }

  .line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
  }

  .alert {
    color: #ff5050;
    font-weight: bold;
  }

  .glitch {
    transform: translateX(-0.6em) skewX(-12deg);
    opacity: 0.8;
    text-shadow:
      3px 0 rgba(0, 255, 255, 0.5),
      -3px 0 rgba(255, 0, 0, 0.8);
  }
</style>
