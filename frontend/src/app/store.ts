import { create } from "zustand";
import i18n from "@/i18n";

type AppState = {
  language: string;
  autoDetect: boolean;
  darkMode: boolean;
  setLanguage: (language: string) => void;
  toggleAutoDetect: () => void;
  toggleDarkMode: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  language: "en",
  autoDetect: true,
  darkMode: false,
  // Choosing a specific language turns auto-detection off and localizes the UI.
  setLanguage: (language) => {
    void i18n.changeLanguage(language);
    set({ language, autoDetect: false });
  },
  toggleAutoDetect: () => set((state) => ({ autoDetect: !state.autoDetect })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode }))
}));
