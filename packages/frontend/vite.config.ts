/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // @testing-library/react resolves from the workspace root, where npm
      // hoisted a second React, so JSX was created by one copy and rendered by
      // another - React then reports every element as an invalid child. dedupe
      // alone does not cover packages resolved outside this workspace, so pin
      // both explicitly to this package's React.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    // npm hoists a second React to the workspace root to satisfy an older peer
    // range, so tests rendered components with one React while the test
    // renderer used another - React then rejects the elements with "Objects are
    // not valid as a React child". Force a single copy.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow external connections
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI Libraries
          'ui-vendor': ['@heroicons/react', '@headlessui/react'],

          // HTTP and API libraries
          'api-vendor': ['axios'],
        },
      },
    },
    // Increase chunk size warning limit to 600KB (reasonable for chunked bundles)
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
