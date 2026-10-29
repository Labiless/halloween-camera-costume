// Stato condiviso dello sguardo.
// x, y in [-1, 1]: (0,0) = centro, (1,0) = destra, (0,-1) = alto.
// Quando `manual` è true l'occhio segue x/y (es. analogico del controller),
// altrimenti si muove da solo.
export const gaze = $state({
  x: 0,
  y: 0,
  manual: false,
});
