import type { Translations } from "./types";

export const fr: Translations = {
  nav: {
    submit: "Soumettre",
    login: "Connexion",
  },
  home: {
    platform: "Plateforme mondiale",
    tagline: ["Trouve ton prochain", "festival."],
    countStats: (festivals, countries) =>
      `${festivals.toLocaleString()} festivals · ${countries} pays`,
    opportunities: (n) =>
      `${n} opportunité${n !== 1 ? "s" : ""}`,
    search: "Rechercher un festival…",
    country: "Pays",
    genre: "Genre",
    deadline: "Deadline",
    az: "A–Z",
    reset: "Réinitialiser",
    emptyTitle: "Aucun résultat",
    emptyHint: "Modifiez vos filtres pour élargir la recherche",
    resetFilters: "Réinitialiser les filtres",
    festivals: (n) => `${n} festival${n !== 1 ? "s" : ""}`,
  },
  card: {
    apply: "Postuler →",
    save: "Sauvegarder",
  },
  festival: {
    back: "Retour",
    experience: "L'expérience",
    information: "Informations",
    location: "Lieu",
    genre: "Genre",
    deadline: "Deadline",
    apply: "Postuler au festival",
    noApply: "Aucun lien de candidature disponible",
    similar: "Festivals similaires",
    discover: "Découvrir aussi",
    viewAll: "Voir tous →",
    noLocation: "Localisation non disponible",
  },
  deadline: {
    passed: "Deadline passée",
    today: "Deadline aujourd'hui",
    tomorrow: "Deadline demain",
    urgent: (n) => `dans ${n} jour${n !== 1 ? "s" : ""}`,
    inDays: (n) => `dans ${n} jours`,
    inMonths: (n) => `dans ${n} mois`,
  },
};
