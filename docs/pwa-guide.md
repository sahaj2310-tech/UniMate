# PWA Guide

Implemented:

- `manifest.webmanifest`
- app icon
- installable display mode
- theme color
- offline app shell through `vite-plugin-pwa`
- mobile viewport with safe-area support
- touch-friendly controls
- dark mode
- browser-safe speech feature detection

Test:

1. Build frontend with `npm --prefix frontend run build`.
2. Serve with `npm --prefix frontend run preview`.
3. Open Chrome DevTools Application tab.
4. Confirm manifest, service worker, icons, and installability.
5. Test iPhone Safari and Android Chrome safe areas.
