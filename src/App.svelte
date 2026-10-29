<script>
  import { scenes } from './lib/scenes/index.js';
  import { startController, onButton, onStick, BUTTONS } from './lib/controller.svelte.js';

  // Bottoni che portano direttamente a una scena
  const SCENE_BUTTONS = {
    [BUTTONS.SCENE_CAMERA]: 'night-vision',
    [BUTTONS.SCENE_VOICE]: 'voice',
    [BUTTONS.SCENE_GIFS]: 'apocalypse',
  };

  $effect(() => startController());
  $effect(() =>
    onButton((b) => {
      if (b === BUTTONS.NEXT_SCENE) goTo(current + 1);
      else if (b in SCENE_BUTTONS) goToId(SCENE_BUTTONS[b]);
    })
  );
  // Muovere l'analogico riporta sempre all'occhio
  $effect(() => onStick(() => goToId('eye')));

  // ?scene=<id> nell'URL apre direttamente quella scena (comodo in sviluppo)
  const initial = scenes.findIndex((s) => s.id === new URLSearchParams(location.search).get('scene'));
  let current = $state(Math.max(0, initial));
  let scene = $derived(scenes[current]);

  function goTo(i) {
    current = (i + scenes.length) % scenes.length;
  }

  function goToId(id) {
    const i = scenes.findIndex((s) => s.id === id);
    if (i >= 0) current = i;
  }

  // Tastiera: frecce per scorrere le scene (1, 2, S e spazio sono gestiti come bottoni del controller)
  function onKeydown(e) {
    if (e.key === 'ArrowRight') goTo(current + 1);
    else if (e.key === 'ArrowLeft') goTo(current - 1);
  }

  // Tap: schermo intero + niente standby, così il telefono resta acceso nel costume.
  let wakeLock = null;
  async function onTap() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      // Il telefono sta sempre in orizzontale (funziona solo in fullscreen, su Android)
      await screen.orientation?.lock?.('landscape');
    } catch {}
    try {
      if (!wakeLock && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      }
    } catch {}
  }
</script>

<svelte:window onkeydown={onKeydown} />
<svelte:document onvisibilitychange={() => document.visibilityState === 'visible' && wakeLock === null && onTap()} />

<main onpointerdown={onTap}>
  {#key scene.id}
    <scene.component />
  {/key}
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    background: #000;
    cursor: none;
  }
</style>
