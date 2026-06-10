import type { Translations } from "./types";

export const fr: Translations = {
  nav: {
    submit: "Soumettre un festival",
    login: "Connexion",
  },
  home: {
    platform: "Opportunités de festivals pour les professionnels de la musique",
    tagline: ["Ta prochaine opportunité", "de carrière commence ici."],
    live: "En direct",
    openCalls: (n) => `${n} appel${n !== 1 ? "s" : ""} ouvert${n !== 1 ? "s" : ""}`,
    countStats: (festivals, countries) =>
      `${festivals.toLocaleString()} opportunités · ${countries} pays`,
    opportunities: (n) =>
      `${n} opportunité${n !== 1 ? "s" : ""}`,
    search: "Rechercher une opportunité…",
    country: "Pays",
    genre: "Genre",
    deadline: "Urgent",
    az: "A–Z",
    reset: "Réinitialiser",
    emptyTitle: "Aucune opportunité trouvée",
    emptyHint: "Modifiez vos filtres pour élargir la recherche",
    resetFilters: "Réinitialiser les filtres",
    festivals: (n) => `${n} opportunité${n !== 1 ? "s" : ""}`,
    genres: (n) => `${n} genre${n !== 1 ? "s" : ""}`,
    countries: (n) => `${n} pay${n !== 1 ? "s" : ""}`,
    showAll: "Tout afficher",
    contextTagline: (n, genre, country) => {
      if (genre && country) return [`${n} opportunités`, `${genre} en ${country}.`];
      if (genre) return [`${n} opportunités`, `${genre}.`];
      if (country) return [`${n} opportunité${n !== 1 ? "s" : ""}`, `en ${country}.`];
      return [`${n} opportunité${n !== 1 ? "s" : ""}`, `disponible${n !== 1 ? "s" : ""}.`];
    },
    closingSoon: (n) => `${n} ferment cette semaine`,
    urgencyGroups: {
      thisWeek:   "Cette semaine",
      thisMonth:  "Ce mois-ci",
      upcoming:   "À venir",
      noDeadline: "Deadline ouverte",
      expired:    "Fermé",
    },
    urgencyTabs: {
      all:       "Tout",
      thisWeek:  (n) => n > 0 ? `Cette semaine · ${n}` : "Cette semaine",
      thisMonth: (n) => n > 0 ? `Ce mois · ${n}` : "Ce mois",
    },
  },
  card: {
    apply: "Postuler",
    save: "Sauvegarder",
  },
  festival: {
    back: "Retour",
    experience: "L'expérience",
    information: "Détails de l'opportunité",
    location: "Lieu",
    genre: "Genre",
    deadline: "Deadline",
    apply: "Postuler à ce festival",
    noApply: "Aucun lien de candidature disponible",
    similar: "Plus d'opportunités",
    discover: "Continuer l'exploration",
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
  error: {
    connection: "Erreur de connexion à la base de données.",
  },
};
