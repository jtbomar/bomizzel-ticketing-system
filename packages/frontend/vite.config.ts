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
    },
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
          'ui-vendor': [
            '@heroicons/react',
            '@headlessui/react'
          ],
          
          // HTTP and API libraries
          'api-vendor': ['axios']
        }
      }
    },
    // Increase chunk size warning limit to 600KB (reasonable for chunked bundles)
    chunkSizeWarningLimit: 600
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
