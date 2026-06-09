export type { Language, Translations } from "./types";
export { en } from "./en";
export { fr } from "./fr";

import { en } from "./en";
import { fr } from "./fr";
import type { Language, Translations } from "./types";

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "EN" },
  { code: "fr", label: "Français", flag: "FR" },
];

export const DEFAULT_LANGUAGE: Language = "en";

export const LANG_COOKIE = "uberfestival_lang";

export function getTranslations(lang: Language): Translations {
  return lang === "fr" ? fr : en;
}

export function isValidLanguage(lang: string | undefined): lang is Language {
  return lang === "en" || lang === "fr";
}
