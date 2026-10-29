<script>
  import { scenes } from './lib/scenes/index.js';
  import { startController } from './lib/controller.svelte.js';

  $effect(() => startController());

  let current = $state(0);
  let scene = $derived(scenes[current]);

  function goTo(i) {
    current = (i + scenes.length) % scenes.length;
  }

  // Temporaneo: tastiera per cambiare scena finché non colleghiamo il controller.
  function onKeydown(e) {
    if (e.key === 'ArrowRight') goTo(current + 1);
    else if (e.key === 'ArrowLeft') goTo(current - 1);
    else if (/^[1-9]$/.test(e.key) && +e.key <= scenes.length) goTo(+e.key - 1);
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
