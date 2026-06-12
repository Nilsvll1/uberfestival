import type { Translations } from "./types";

export const en: Translations = {
  nav: {
    explore: "Explore",
    submit: "Submit a festival",
    login: "Sign in",
  },
  home: {
    platform: "Festival opportunities for music professionals",
    tagline: ["Your next career", "opportunity starts here."],
    live: "Live",
    openCalls: (n) => `${n} open call${n !== 1 ? "s" : ""}`,
    countStats: (festivals, countries) =>
      `${festivals.toLocaleString()} opportunities · ${countries} ${countries !== 1 ? "countries" : "country"}`,
    opportunities: (n) =>
      `${n} opportunit${n !== 1 ? "ies" : "y"}`,
    search: "Search opportunities…",
    country: "Country",
    genre: "Genre",
    deadline: "Urgent",
    az: "A–Z",
    reset: "Reset",
    emptyTitle: "No opportunities found",
    emptyHint: "Adjust your filters to find more open calls",
    resetFilters: "Reset filters",
    festivals: (n) => `${n} opportunit${n !== 1 ? "ies" : "y"}`,
    genres: (n) => `${n} genre${n !== 1 ? "s" : ""}`,
    countries: (n) => `${n} countr${n !== 1 ? "ies" : "y"}`,
    showAll: "Show all",
    contextTagline: (n, genre, country) => {
      if (genre && country) return [`${n} ${genre}`, `in ${country}.`];
      if (genre) return [`${n} ${genre}`, `opportunit${n !== 1 ? "ies" : "y"}.`];
      if (country) return [`${n} opportunit${n !== 1 ? "ies" : "y"}`, `in ${country}.`];
      return [`${n} opportunit${n !== 1 ? "ies" : "y"}`, `available.`];
    },
    closingSoon: (n) => `${n} closing this week`,
    urgencyGroups: {
      thisWeek:   "Closing this week",
      thisMonth:  "Closing this month",
      upcoming:   "Coming up",
      noDeadline: "Open deadline",
      expired:    "Closed",
    },
    urgencyTabs: {
      all:       "All",
      thisWeek:  (n) => n > 0 ? `This week · ${n}` : "This week",
      thisMonth: (n) => n > 0 ? `This month · ${n}` : "This month",
    },
  },
  card: {
    apply: "Apply now",
    save: "Save",
  },
  festival: {
    back: "Back",
    experience: "The experience",
    information: "Opportunity details",
    location: "Location",
    genre: "Genre",
    deadline: "Deadline",
    apply: "Apply to this festival",
    noApply: "No application link available",
    similar: "More opportunities",
    discover: "Keep exploring",
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
  error: {
    connection: "Unable to connect to the database.",
  },
};
