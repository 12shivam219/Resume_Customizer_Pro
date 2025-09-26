import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import imagemin from 'vite-plugin-imagemin';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      babel: {
        plugins: ['@babel/plugin-transform-runtime'],
        babelrc: false,
        configFile: false,
      },
    }),
    runtimeErrorOverlay(),
    imagemin({
      gifsicle: {
        optimizationLevel: 7,
        interlaced: false,
      },
      optipng: {
        optimizationLevel: 7,
      },
      mozjpeg: {
        quality: 80,
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4,
      },
      webp: {
        quality: 75,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: 'es2019',
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    assetsInlineLimit: 4096, // 4kb
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split large, commonly used libraries into separate vendor chunks
            if (id.match(/[/\\]react([/\\]|$)/) || id.match(/[/\\]react-dom([/\\]|$)/)) return 'vendor.react';
            if (id.match(/[/\\]@radix-ui[/\\]/)) return 'vendor.radix';
            if (id.match(/[/\\]@tanstack[/\\]react-query/)) return 'vendor.react-query';
            if (id.match(/[/\\](recharts|d3|framer-motion|chart.js)[/\\]/)) return 'vendor.visual';
            if (id.match(/[/\\](docx|html2canvas|jspdf|jszip|pizzip)[/\\]/)) return 'vendor.docs';
            if (id.match(/[/\\](lucide-react|react-icons)[/\\]/)) return 'vendor.icons';
            // Fallback vendor chunk
            return 'vendor';
          }
        },
      },
    },
    // Raise the chunk size warning so noise from large-but-expected bundles is reduced
    chunkSizeWarningLimit: 1200,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
