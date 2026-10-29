import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS (certificato self-signed): Chrome espone la Gamepad API solo in contesti sicuri,
// quindi serve per usare il controller dal telefono via IP di rete.
export default defineConfig({
  plugins: [svelte(), basicSsl()],
});
