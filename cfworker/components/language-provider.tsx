"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Lang,
  languageStorageKey,
  translateBackendText,
  translateReportKey,
  translateStatusLabel,
  translateUi
} from "../lib/i18n";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectInitialLang(): Lang {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(languageStorageKey);
  if (stored === "en" || stored === "zh") {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    setLang(detectInitialLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem(languageStorageKey, lang);
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang: () => setLang((current) => (current === "en" ? "zh" : "en"))
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return {
    ...value,
    copy: translateUi(value.lang),
    translateBackendText: (text: string) => translateBackendText(text, value.lang),
    translateReportKey: (key?: string, params?: Record<string, string | number>) =>
      translateReportKey(key, value.lang, params),
    translateStatusLabel: (text: string) => translateStatusLabel(text, value.lang)
  };
}

export function LanguageToggle() {
  const { toggleLang, copy } = useLanguage();

  return (
    <button type="button" className="lang-toggle" onClick={toggleLang}>
      {copy.toggle}
    </button>
  );
}
