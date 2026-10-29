<script>
  // Overlay da vecchia telecamera di sorveglianza, comune a tutte le scene:
  // scanline, grana, vignettatura, REC lampeggiante e timestamp.
  let { label = '', channel = 1 } = $props();

  let now = $state(new Date());
  let noiseUrl = $state('');

  $effect(() => {
    const id = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(id);
  });

  $effect(() => {
    const size = 160;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    noiseUrl = c.toDataURL();
  });

  const pad = (n) => String(n).padStart(2, '0');
  let stamp = $derived(
    `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}  ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
</script>

<div class="overlay">
  <div class="noise" style:background-image={noiseUrl ? `url(${noiseUrl})` : 'none'}></div>
  <div class="scanlines"></div>
  <div class="vignette"></div>

  <div class="hud">
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>

    <div class="rec"><span class="dot"></span>REC</div>
    <div class="cam">CAM-{String(channel).padStart(2, '0')} · {label}</div>
    <div class="stamp">{stamp}</div>
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .noise {
    position: absolute;
    inset: -50%;
    opacity: 0.07;
    mix-blend-mode: screen;
    animation: grain 0.4s steps(6) infinite;
  }

  @keyframes grain {
    0% { transform: translate(0, 0); }
    20% { transform: translate(-7%, 4%); }
    40% { transform: translate(5%, -9%); }
    60% { transform: translate(-3%, 8%); }
    80% { transform: translate(9%, -2%); }
    100% { transform: translate(-5%, -6%); }
  }

  .scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0) 0px,
      rgba(0, 0, 0, 0) 2px,
      rgba(0, 0, 0, 0.28) 3px,
      rgba(0, 0, 0, 0) 4px
    );
  }

  /* Banda luminosa che scorre, tipica dei vecchi CRT */
  .scanlines::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 18%;
    background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.035), transparent);
    animation: roll 7s linear infinite;
  }

  @keyframes roll {
    from { top: -20%; }
    to { top: 110%; }
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.75) 100%);
  }

  .hud {
    position: absolute;
    inset: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right))
      max(14px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
    color: rgba(235, 235, 235, 0.85);
    font-size: clamp(11px, 2.4vmin, 20px);
    letter-spacing: 0.12em;
    text-shadow: 0 0 4px rgba(255, 255, 255, 0.4);
  }

  .corner {
    position: absolute;
    width: 6vmin;
    height: 6vmin;
    border: 2px solid rgba(235, 235, 235, 0.55);
  }
  .tl { top: 0; left: 0; border-right: 0; border-bottom: 0; }
  .tr { top: 0; right: 0; border-left: 0; border-bottom: 0; }
  .bl { bottom: 0; left: 0; border-right: 0; border-top: 0; }
  .br { bottom: 0; right: 0; border-left: 0; border-top: 0; }

  .rec {
    position: absolute;
    top: 2.5vmin;
    left: 3vmin;
    display: flex;
    align-items: center;
    gap: 0.6em;
    color: #ff3b3b;
    text-shadow: 0 0 6px rgba(255, 0, 0, 0.8);
  }
  .dot {
    width: 0.8em;
    height: 0.8em;
    border-radius: 50%;
    background: #ff2020;
    box-shadow: 0 0 8px #ff0000;
    animation: blink 1s steps(1) infinite;
  }
  @keyframes blink {
    50% { opacity: 0; }
  }

  .cam {
    position: absolute;
    top: 2.5vmin;
    right: 3vmin;
  }

  .stamp {
    position: absolute;
    bottom: 2.5vmin;
    left: 3vmin;
  }
</style>
