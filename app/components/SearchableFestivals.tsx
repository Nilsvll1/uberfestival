"use client";

import { useMemo, useState } from "react";
import type { Festival } from "../../lib/types";
import FestivalMapWrapper from "./FestivalMapWrapper";
import FilterDropdown from "./FilterDropdown";
import FestivalCard from "./FestivalCard";

type SortKey = "deadline" | "name";

function sortFestivals(festivals: Festival[], sort: SortKey): Festival[] {
  if (sort === "name") {
    return [...festivals].sort((a, b) =>
      a.festival_name.localeCompare(b.festival_name)
    );
  }
  const now = Date.now();
  return [...festivals].sort((a, b) => {
    const da = a.submission_deadline
      ? new Date(a.submission_deadline).getTime()
      : null;
    const db = b.submission_deadline
      ? new Date(b.submission_deadline).getTime()
      : null;
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    const aFuture = da >= now;
    const bFuture = db >= now;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return da - db;
  });
}

export default function SearchableFestivals({
  festivals,
}: {
  festivals: Festival[];
}) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortKey>("deadline");

  const countries = useMemo(
    () =>
      [...new Set(festivals.map((f) => f.country).filter(Boolean))].sort(),
    [festivals]
  );

  const categories = useMemo(
    () =>
      [...new Set(festivals.map((f) => f.category).filter(Boolean))].sort(),
    [festivals]
  );

  const filtered = useMemo(() => {
    const base = festivals.filter((f) => {
      const matchName =
        query.trim() === "" ||
        f.festival_name.toLowerCase().includes(query.toLowerCase());
      const matchCountry = country === "" || f.country === country;
      const matchCategory = category === "" || f.category === category;
      return matchName && matchCountry && matchCategory;
    });
    return sortFestivals(base, sort);
  }, [festivals, query, country, category, sort]);

  const hasFilters =
    query.trim() !== "" || country !== "" || category !== "";

  function reset() {
    setQuery("");
    setCountry("");
    setCategory("");
  }

  return (
    <div>
      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Recherche */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-muted)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom du festival..."
            className="pl-9 pr-4 py-1.5 rounded-full border text-sm focus:outline-none transition-colors"
            style={{
              borderColor: query ? "var(--accent)" : "var(--border)",
              background: "#fff",
              color: "var(--text-primary)",
              width: "220px",
            }}
          />
        </div>

        <FilterDropdown
          label="Pays"
          value={country}
          options={countries}
          onChange={setCountry}
        />
        <FilterDropdown
          label="Genre"
          value={category}
          options={categories}
          onChange={setCategory}
        />

        {/* Tri */}
        <div
          className="flex items-center rounded-full border overflow-hidden ml-1"
          style={{ borderColor: "var(--border)" }}
        >
          {(["deadline", "name"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className="text-xs px-3 py-1.5 transition-colors"
              style={{
                background: sort === key ? "var(--text-primary)" : "#fff",
                color: sort === key ? "#fff" : "var(--text-secondary)",
              }}
            >
              {key === "deadline" ? "Deadline" : "A–Z"}
            </button>
          ))}
        </div>

        {/* Compteur + reset */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {filtered.length}
            </span>{" "}
            festival{filtered.length !== 1 ? "s" : ""}
          </span>
          {hasFilters && (
            <button
              onClick={reset}
              className="text-xs transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Split view */}
      <div className="lg:flex lg:gap-5 lg:items-start">
        {/* Carte — en haut sur mobile, à droite sticky sur desktop */}
        <div
          className="h-[45vh] mb-5 lg:mb-0 lg:order-2 lg:h-[calc(100vh-5rem)]"
          style={{ flex: "0 0 55%" }}
        >
          <div className="lg:sticky lg:top-20 h-full">
            <FestivalMapWrapper festivals={filtered} className="h-full" />
          </div>
        </div>

        {/* Liste — en bas sur mobile, à gauche sur desktop */}
        <div className="lg:order-1 min-w-0" style={{ flex: "0 0 45%" }}>
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Aucun festival ne correspond à votre recherche.
              </p>
              {hasFilters && (
                <button
                  onClick={reset}
                  className="mt-3 text-sm"
                  style={{ color: "var(--accent)" }}
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {filtered.map((festival) => (
                <li key={festival.id}>
                  <FestivalCard festival={festival} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
