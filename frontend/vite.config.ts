import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "UniMate",
        short_name: "UniMate",
        description: "Verified multilingual AI Assistant",
        theme_color: "#0758d8",
        background_color: "#f7f9fd",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        icons: [
          { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"]
      }
    })
  ],
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      "@": "/src"
    }
  }
});
