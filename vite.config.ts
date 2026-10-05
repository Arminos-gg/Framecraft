import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the built app works from any folder or host.
  base: './',
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
