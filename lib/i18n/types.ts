export type Language = "en" | "fr";

export type Translations = {
  nav: {
    submit: string;
    login: string;
  };
  home: {
    platform: string;
    tagline: [string, string];
    live: string;
    openCalls: (n: number) => string;
    countStats: (festivals: number, countries: number) => string;
    opportunities: (n: number) => string;
    search: string;
    country: string;
    genre: string;
    deadline: string;
    az: string;
    reset: string;
    emptyTitle: string;
    emptyHint: string;
    resetFilters: string;
    festivals: (n: number) => string;
    genres: (n: number) => string;
    countries: (n: number) => string;
  };
  card: {
    apply: string;
    save: string;
  };
  festival: {
    back: string;
    experience: string;
    information: string;
    location: string;
    genre: string;
    deadline: string;
    apply: string;
    noApply: string;
    similar: string;
    discover: string;
    viewAll: string;
    noLocation: string;
  };
  deadline: {
    passed: string;
    today: string;
    tomorrow: string;
    urgent: (n: number) => string;
    inDays: (n: number) => string;
    inMonths: (n: number) => string;
  };
};
