import { gaze } from './gaze.svelte.js';

// Mappatura del controller Bluetooth (vedi gamepad-test.html).
// L'analogico è un hat switch a 8 direzioni codificato su un solo asse:
// valori tra -1 e 1 a passi di 2/7, ~1.29 = fermo.
const HAT_AXIS = 9;
// La codifica di questo controller è ruotata di 90°: "destra" arriva come "su".
const HAT_OFFSET = 2;
// Su Android (mapping "standard") lo stesso analogico arriva come croce direzionale:
// bottoni 12-15. Stessa rotazione da correggere, se serve si regola a parte.
const DPAD = { up: 12, down: 13, left: 14, right: 15 };
const DPAD_OFFSET = 2;
// Quanto lontano guarda l'occhio quando punti (1 = bordo massimo).
const REACH = 0.95;
// Dopo aver rilasciato, l'occhio resta al centro per questo tempo, poi torna autonomo.
const RETURN_TO_AUTO_MS = 4000;

// Bottoni del controller (indici della Gamepad API)
export const BUTTONS = {
  ACTION: 0, // azione della scena (es. foto del volto)
  SCENE_CAMERA: 1, // vai alla scena night vision
  SCENE_VOICE: 2, // vai alla scena voce
  SCENE_GIFS: 3, // vai alla scena apocalisse (GIF)
  NEXT_SCENE: 4, // scena successiva, a ciclo
};

// Tasti per provare sul Mac senza controller
const KEYBOARD = {
  ' ': BUTTONS.ACTION,
  1: BUTTONS.SCENE_CAMERA,
  2: BUTTONS.SCENE_VOICE,
  3: BUTTONS.SCENE_GIFS,
  s: BUTTONS.NEXT_SCENE,
  S: BUTTONS.NEXT_SCENE,
};

const listeners = new Set();
const stickListeners = new Set();

// Registra una callback chiamata con l'indice del bottone a ogni pressione.
// Restituisce la funzione per rimuoverla (va bene come return di un $effect).
export function onButton(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Callback chiamata quando l'analogico esce dalla posizione di riposo.
export function onStick(cb) {
  stickListeners.add(cb);
  return () => stickListeners.delete(cb);
}

function emit(index) {
  for (const cb of listeners) cb(index);
}

// Direzioni: 0 = su, poi in senso orario fino a 7; null = fermo
function decodeHat(v) {
  if (v === undefined || v > 1.1 || v < -1.1) return null;
  return (Math.round((v + 1) / (2 / 7)) + HAT_OFFSET) % 8;
}

function decodeDpad(buttons) {
  const p = (i) => (buttons[i]?.pressed ? 1 : 0);
  const x = p(DPAD.right) - p(DPAD.left);
  const y = p(DPAD.down) - p(DPAD.up);
  if (!x && !y) return null;
  return (Math.round(Math.atan2(x, -y) / (Math.PI / 4)) + 8 + DPAD_OFFSET) % 8;
}

// Mac: hat switch sull'asse 9. Android: croce direzionale sui bottoni 12-15.
function readDirection(gp) {
  return decodeHat(gp.axes[HAT_AXIS]) ?? decodeDpad(gp.buttons);
}

export function startController() {
  let raf;
  let releasedAt = 0;
  let wasPointing = false;
  const prevButtons = [];

  function poll() {
    const gp = [...navigator.getGamepads()].find(Boolean);
    const dir = gp ? readDirection(gp) : null;

    // Evento solo sul fronte di pressione, non mentre il bottone resta premuto
    gp?.buttons.forEach((b, i) => {
      if (b.pressed && !prevButtons[i]) emit(i);
      prevButtons[i] = b.pressed;
    });

    if (dir !== null && !wasPointing) for (const cb of stickListeners) cb();

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

  const onKeydown = (e) => {
    if (e.repeat || !(e.key in KEYBOARD)) return;
    e.preventDefault();
    emit(KEYBOARD[e.key]);
  };
  window.addEventListener('keydown', onKeydown);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeydown);
  };
}
