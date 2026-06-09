import type { Translations } from "./types";

export const en: Translations = {
  nav: {
    submit: "Submit",
    login: "Sign in",
  },
  home: {
    platform: "Open calls worldwide",
    tagline: ["Find your next", "festival."],
    live: "Live",
    openCalls: (n) => `${n} open call${n !== 1 ? "s" : ""}`,
    countStats: (festivals, countries) =>
      `${festivals.toLocaleString()} festivals · ${countries} ${countries !== 1 ? "countries" : "country"}`,
    opportunities: (n) =>
      `${n} opportunit${n !== 1 ? "ies" : "y"}`,
    search: "Search a festival…",
    country: "Country",
    genre: "Genre",
    deadline: "Deadline",
    az: "A–Z",
    reset: "Reset",
    emptyTitle: "No results",
    emptyHint: "Adjust your filters to broaden the search",
    resetFilters: "Reset filters",
    festivals: (n) => `${n} festival${n !== 1 ? "s" : ""}`,
    genres: (n) => `${n} genre${n !== 1 ? "s" : ""}`,
    countries: (n) => `${n} countr${n !== 1 ? "ies" : "y"}`,
  },
  card: {
    apply: "Apply →",
    save: "Save",
  },
  festival: {
    back: "Back",
    experience: "The experience",
    information: "Information",
    location: "Location",
    genre: "Genre",
    deadline: "Deadline",
    apply: "Apply to festival",
    noApply: "No application link available",
    similar: "Similar festivals",
    discover: "Discover more",
    viewAll: "View all →",
    noLocation: "Location unavailable",
  },
  deadline: {
    passed: "Deadline passed",
    today: "Deadline today",
    tomorrow: "Tomorrow",
    urgent: (n) => `${n} day${n !== 1 ? "s" : ""} left`,
    inDays: (n) => `in ${n} days`,
    inMonths: (n) => `in ${n} month${n !== 1 ? "s" : ""}`,
  },
};
