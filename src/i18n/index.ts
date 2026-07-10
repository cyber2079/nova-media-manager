import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

// Statically load zh (fallback) + en (most common). Other 5 languages loaded on-demand.
const eagerResources = { zh: { translation: zh }, en: { translation: en } };

const localeLoaders: Record<string, () => Promise<any>> = {
  fr: () => import("./locales/fr.json"),
  it: () => import("./locales/it.json"),
  de: () => import("./locales/de.json"),
  ja: () => import("./locales/ja.json"),
  ko: () => import("./locales/ko.json"),
};

const saved = localStorage.getItem("app-lang") || "zh";

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: eagerResources,
  lng: saved,
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
  detection: { order: ["localStorage"], lookupLocalStorage: "app-lang" },
});

// Lazy-load missing locale bundles on language change
i18n.on("languageChanged", (lng) => {
  if (!i18n.hasResourceBundle(lng, "translation")) {
    const loader = localeLoaders[lng];
    if (loader) {
      loader().then((mod) => {
        i18n.addResourceBundle(lng, "translation", mod.default, true, true);
        i18n.changeLanguage(lng); // re-render with new bundle
      });
    }
  }
});

export const languages = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

export default i18n;
