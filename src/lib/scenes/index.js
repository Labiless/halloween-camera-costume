import EyeScene from './EyeScene.svelte';
import NightVisionScene from './NightVisionScene.svelte';

// Registro delle scene. Per aggiungerne una: crea il componente e aggiungilo qui.
// Il bottone 4 del controller le scorre a ciclo in quest'ordine.
export const scenes = [
  { id: 'eye', label: 'EYE', component: EyeScene },
  { id: 'night-vision', label: 'NIGHT VISION', component: NightVisionScene },
];
