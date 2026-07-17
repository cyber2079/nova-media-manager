import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";

// All 7 languages eager-loaded (~200 KB total — negligible).
// Avoids init-time fallback-to-zh caused by lazy-load race on saved language.
const resources = {
  zh: { translation: zh },
  en: { translation: en },
  ja: { translation: ja },
  ko: { translation: ko },
  de: { translation: de },
  fr: { translation: fr },
  it: { translation: it },
};

// 单一真相来源：app-lang，手动管理
const saved = localStorage.getItem("app-lang") || "zh";

i18n.use(initReactI18next).init({
  resources,
  lng: saved,
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

export const languages = [
  { code: "zh", label: "中文", i18nKey: "languages.zh" },
  { code: "en", label: "English", i18nKey: "languages.en" },
  { code: "fr", label: "Français", i18nKey: "languages.fr" },
  { code: "it", label: "Italiano", i18nKey: "languages.it" },
  { code: "de", label: "Deutsch", i18nKey: "languages.de" },
  { code: "ja", label: "日本語", i18nKey: "languages.ja" },
  { code: "ko", label: "한국어", i18nKey: "languages.ko" },
];

export default i18n;
