/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#1677ff",
          600: "#0758d8",
          700: "#0647ac",
          900: "#071b4d"
        },
        trust: "#13a05f",
        warn: "#f59e0b",
        ink: "#0f172a"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(15, 23, 42, 0.08)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
