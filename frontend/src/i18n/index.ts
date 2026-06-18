import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./translations";

export const supportedLanguages = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "ko", nativeName: "한국어", englishName: "Korean" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
  { code: "bn", nativeName: "বাংলা", englishName: "Bangla" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
  { code: "zh", nativeName: "中文", englishName: "Chinese" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  { code: "ru", nativeName: "Русский", englishName: "Russian" },
  { code: "mn", nativeName: "Монгол", englishName: "Mongolian" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
  { code: "fr", nativeName: "Français", englishName: "French" },
  { code: "ms", nativeName: "Bahasa Melayu", englishName: "Malay" },
  { code: "ta", nativeName: "தமிழ்", englishName: "Tamil" },
  { code: "th", nativeName: "ไทย", englishName: "Thai" }
];

const supportedLanguageCodes = supportedLanguages.map((language) => language.code);

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  supportedLngs: supportedLanguageCodes,
  nonExplicitSupportedLngs: true,
  cleanCode: true,
  // English source strings are used as keys, so disable key/namespace separators
  // and fall back to the key itself when a translation is missing.
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false
});

export default i18n;
