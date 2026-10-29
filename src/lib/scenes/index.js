import EyeScene from './EyeScene.svelte';

// Registro delle scene. Per aggiungerne una: crea il componente e aggiungilo qui.
// Il controller (più avanti) scorrerà questa lista con i bottoni.
export const scenes = [
  { id: 'eye', label: 'EYE', component: EyeScene },
];
