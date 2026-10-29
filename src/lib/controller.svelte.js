import { gaze } from './gaze.svelte.js';

// Mappatura del controller Bluetooth (vedi gamepad-test.html).
// L'analogico è un hat switch a 8 direzioni codificato su un solo asse:
// valori tra -1 e 1 a passi di 2/7, ~1.29 = fermo.
const HAT_AXIS = 9;
// La codifica di questo controller è ruotata di 90°: "destra" arriva come "su".
const HAT_OFFSET = 2;
// Quanto lontano guarda l'occhio quando punti (1 = bordo massimo).
const REACH = 0.95;
// Dopo aver rilasciato, l'occhio resta al centro per questo tempo, poi torna autonomo.
const RETURN_TO_AUTO_MS = 4000;

// 0 = su, poi in senso orario; null = fermo
function decodeHat(v) {
  if (v === undefined || v > 1.1 || v < -1.1) return null;
  return (Math.round((v + 1) / (2 / 7)) + HAT_OFFSET) % 8;
}

export function startController() {
  let raf;
  let releasedAt = 0;
  let wasPointing = false;

  function poll() {
    const gp = [...navigator.getGamepads()].find(Boolean);
    const dir = gp ? decodeHat(gp.axes[HAT_AXIS]) : null;

    if (dir !== null) {
      // Punta: l'occhio guarda nella direzione premuta
      const a = (dir * Math.PI) / 4;
      gaze.manual = true;
      gaze.x = Math.sin(a) * REACH;
      gaze.y = -Math.cos(a) * REACH;
      wasPointing = true;
    } else if (wasPointing) {
      // Torna: rilasciato, si rimette al centro
      gaze.x = 0;
      gaze.y = 0;
      releasedAt = performance.now();
      wasPointing = false;
    } else if (gaze.manual && performance.now() - releasedAt > RETURN_TO_AUTO_MS) {
      gaze.manual = false;
    }

    raf = requestAnimationFrame(poll);
  }
  poll();

  return () => cancelAnimationFrame(raf);
}
