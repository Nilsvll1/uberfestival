"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Festival } from "../../lib/types";
import FestivalMapWrapper from "./FestivalMapWrapper";
import FilterDropdown from "./FilterDropdown";
import FestivalCard from "./FestivalCard";
import { useI18n } from "../hooks/useI18n";

type SortKey = "deadline" | "name";

const TODAY_ISO = new Date().toISOString().slice(0, 10);

function sortFestivals(festivals: Festival[], sort: SortKey): Festival[] {
  if (sort === "name")
    return [...festivals].sort((a, b) => a.festival_name.localeCompare(b.festival_name));
  return [...festivals].sort((a, b) => {
    const da = a.submission_deadline?.slice(0, 10) ?? null;
    const db = b.submission_deadline?.slice(0, 10) ?? null;
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    const aFuture = da >= TODAY_ISO, bFuture = db >= TODAY_ISO;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return aFuture ? da.localeCompare(db) : db.localeCompare(da);
  });
}

export default function SearchableFestivals({ festivals }: { festivals: Festival[] }) {
  const { lang, t } = useI18n();
  const h = t.home;

  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const [query,     setQuery]     = useState(() => searchParams.get("q")       ?? "");
  const [country,   setCountry]   = useState(() => searchParams.get("country") ?? "");
  const [category,  setCategory]  = useState(() => searchParams.get("genre")   ?? "");
  const [sort,      setSort]      = useState<SortKey>("deadline");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const searchRef    = useRef<HTMLInputElement>(null);
  const mobileSearch = useRef<HTMLInputElement>(null);
  const cardElRefs   = useRef<Map<number, HTMLLIElement>>(new Map());
  const didMount     = useRef(false);

  const countries   = useMemo(() => [...new Set(festivals.map(f => f.country).filter(Boolean))].sort() as string[], [festivals]);
  const categories  = useMemo(() => [...new Set(festivals.map(f => f.category).filter(Boolean))].sort() as string[], [festivals]);
  const uniqueCountriesCount = useMemo(() => new Set(festivals.map(f => f.country).filter(Boolean)).size, [festivals]);

  const filtered = useMemo(() => {
    const base = festivals.filter(f => {
      const matchName    = query.trim() === "" || f.festival_name.toLowerCase().includes(query.toLowerCase());
      const matchCountry = country   === "" || f.country   === country;
      const matchCat     = category  === "" || f.category  === category;
      return matchName && matchCountry && matchCat;
    });
    return sortFestivals(base, sort);
  }, [festivals, query, country, category, sort]);

  const hasFilters = query.trim() !== "" || country !== "" || category !== "";

  const reset = useCallback(() => { setQuery(""); setCountry(""); setCategory(""); }, []);

  // "/" keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        (searchRef.current ?? mobileSearch.current)?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Sync filter state to URL (skip first render to avoid replacing URL on mount)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const params = new URLSearchParams();
    if (query)    params.set("q",       query);
    if (country)  params.set("country", country);
    if (category) params.set("genre",   category);
    const qs = params.toString();
    router.replace(pathname + (qs ? `?${qs}` : ""), { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, country, category]);

  // Scroll active card into view when hover comes from the map
  useEffect(() => {
    if (hoveredId === null) return;
    cardElRefs.current.get(hoveredId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [hoveredId]);

  const hasSomeHover = hoveredId !== null;

  return (
    <>
      {/* ─── DESKTOP ──────────────────────────────────────────── */}
      <div className="hidden lg:block relative" style={{ height: "calc(100vh - 52px)" }}>

        {/* Full-viewport map */}
        <div className="absolute inset-0">
          <FestivalMapWrapper
            festivals={filtered}
            className="h-full"
            scrollWheelZoom
            hoveredId={hoveredId}
            onHoverChange={setHoveredId}
          />
        </div>

        {/* Glass panel */}
        <div
          className="absolute top-0 left-0 h-full flex flex-col"
          style={{
            width: 420,
            zIndex: 450,
            background: "rgba(249,249,251,0.92)",
            backdropFilter: "blur(32px) saturate(200%)",
            WebkitBackdropFilter: "blur(32px) saturate(200%)",
            borderRight: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "12px 0 48px rgba(0,0,0,0.07)",
          }}
        >
          {/* ── Panel header ─────────────────────────────────── */}
          <div className="shrink-0 px-6 pt-6 pb-5">

            {/* Live indicator */}
            <div className="flex items-center gap-2 mb-4">
              <span className="live-dot" aria-hidden="true" />
              <span
                className="font-semibold uppercase"
                style={{ fontSize: "10px", letterSpacing: "0.08em", color: "#059669" }}
              >
                {h.live}
              </span>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>·</span>
              <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 500 }}>
                {h.openCalls(festivals.length)}
              </span>
            </div>

            {/* Tagline */}
            <h1
              className="font-extrabold leading-[1.04]"
              style={{ fontSize: "28px", letterSpacing: "-0.04em", color: "var(--text-primary)" }}
            >
              {h.tagline[0]}<br />
              <span style={{ color: "var(--accent)" }}>{h.tagline[1]}</span>
            </h1>

            {/* Stat pills */}
            <div className="flex items-center gap-2 mt-3.5">
              <StatPill>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <circle cx="6" cy="6" r="5"/>
                  <path d="M6 1C4.5 3 3.5 4.5 3.5 6s1 3 2.5 5"/>
                  <path d="M6 1C7.5 3 8.5 4.5 8.5 6s-1 3-2.5 5"/>
                  <path d="M1 6h10"/>
                </svg>
                {h.countries(uniqueCountriesCount)}
              </StatPill>
              <StatPill>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M4 9V3.5L10 2v5.5"/>
                  <circle cx="3" cy="9" r="1.3"/>
                  <circle cx="9" cy="7.5" r="1.3"/>
                </svg>
                {h.genres(categories.length)}
              </StatPill>
            </div>

            {/* Filter result count */}
            {(hasFilters || hasSomeHover) && (
              <p className="mt-3 flex items-center gap-2" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                <span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{filtered.length}</span>
                  {" "}{h.opportunities(filtered.length)}
                </span>
                {hasFilters && (
                  <>
                    <span style={{ color: "var(--border-strong)" }}>·</span>
                    <button
                      onClick={reset}
                      className="hover:opacity-70 transition-opacity"
                      style={{ color: "var(--accent)", fontSize: "12px" }}
                    >
                      {h.reset}
                    </button>
                  </>
                )}
              </p>
            )}
          </div>

          {/* ── Filter controls ───────────────────────────────── */}
          <div
            className="shrink-0 px-5 pb-4"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
          >
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-muted)", width: 13, height: 13 }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={h.search}
                className="input-search w-full rounded-[10px] border"
                style={{
                  fontSize: "13px",
                  padding: "8px 40px 8px 34px",
                  color: "var(--text-primary)",
                  background: "rgba(255,255,255,0.75)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-xs)",
                }}
              />
              {query === "" && (
                <kbd
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    fontSize: "10px", lineHeight: 1, padding: "2px 5px", borderRadius: 4,
                    background: "rgba(0,0,0,0.06)", color: "var(--text-muted)",
                    border: "1px solid rgba(0,0,0,0.10)", fontFamily: "var(--font-geist-mono)",
                  }}
                >
                  /
                </kbd>
              )}
            </div>

            {/* Chips + sort */}
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <FilterDropdown label={h.country}  value={country}  options={countries}  onChange={setCountry}  />
              <FilterDropdown label={h.genre}    value={category} options={categories} onChange={setCategory} />
              <div
                className="flex items-center rounded-full border overflow-hidden ml-auto"
                style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}
              >
                {(["deadline", "name"] as SortKey[]).map(key => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className="transition-colors"
                    style={{
                      fontSize: "12px", padding: "4px 10px",
                      background: sort === key ? "var(--text-primary)" : "rgba(255,255,255,0.8)",
                      color:      sort === key ? "#fff" : "var(--text-muted)",
                      fontWeight: sort === key ? 500 : 400,
                    }}
                  >
                    {key === "deadline" ? h.deadline : h.az}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Scrollable list ────────────────────────────────── */}
          <div className="relative flex-1 min-h-0">
            <div className="h-full overflow-y-auto px-4 py-3">
              {filtered.length === 0 ? (
                <EmptyState hasFilters={hasFilters} onReset={reset} t={t.home} />
              ) : (
                <ul className="flex flex-col gap-2.5 pb-12">
                  {filtered.map((festival, index) => (
                    <li
                      key={festival.id}
                      ref={el => {
                        if (el) cardElRefs.current.set(festival.id, el);
                        else cardElRefs.current.delete(festival.id);
                      }}
                      onMouseEnter={() => setHoveredId(festival.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <FestivalCard
                        festival={festival}
                        index={index}
                        lang={lang}
                        isActive={hoveredId === festival.id}
                        isDimmed={hasSomeHover && hoveredId !== festival.id}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Scroll fade */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0"
              style={{
                height: 64,
                background: "linear-gradient(to bottom, rgba(249,249,251,0) 0%, rgba(249,249,251,0.98) 100%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── MOBILE ───────────────────────────────────────────── */}
      <div className="lg:hidden flex flex-col">
        {/* Map */}
        <div style={{ height: "45vh", flexShrink: 0 }}>
          <FestivalMapWrapper
            festivals={filtered}
            className="h-full"
            scrollWheelZoom
            hoveredId={hoveredId}
            onHoverChange={setHoveredId}
          />
        </div>

        {/* Sticky filter bar */}
        <div
          className="shrink-0 sticky z-30 px-4 py-3"
          style={{
            top: 52,
            background: "rgba(246,246,247,0.97)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)", width: 13, height: 13 }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={mobileSearch}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={h.search}
              className="input-search w-full rounded-[10px] border"
              style={{
                fontSize: "13px", padding: "7px 14px 7px 32px",
                color: "var(--text-primary)", background: "#fff",
                borderColor: "var(--border)", boxShadow: "var(--shadow-xs)",
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <FilterDropdown label={h.country}  value={country}  options={countries}  onChange={setCountry}  />
            <FilterDropdown label={h.genre}    value={category} options={categories} onChange={setCategory} />
            <div
              className="flex items-center rounded-full border overflow-hidden ml-auto"
              style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}
            >
              {(["deadline", "name"] as SortKey[]).map(key => (
                <button key={key} onClick={() => setSort(key)} className="transition-colors"
                  style={{
                    fontSize: "12px", padding: "4px 10px",
                    background: sort === key ? "var(--text-primary)" : "#fff",
                    color: sort === key ? "#fff" : "var(--text-muted)",
                    fontWeight: sort === key ? 500 : 400,
                  }}>
                  {key === "deadline" ? h.deadline : h.az}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Count row */}
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{filtered.length}</span>
            {" "}{h.festivals(filtered.length)}
          </span>
          {hasFilters && (
            <button onClick={reset} className="btn-ghost text-[12px]">{h.reset}</button>
          )}
        </div>

        {/* List */}
        <div className="px-4 pb-8">
          {filtered.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onReset={reset} t={t.home} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((festival, index) => (
                <li key={festival.id}>
                  <FestivalCard festival={festival} index={index} lang={lang} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Stat pill ────────────────────────────────────────────── */
function StatPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        fontSize: "11px",
        fontWeight: 500,
        color: "var(--text-secondary)",
        background: "rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "999px",
        padding: "3px 9px 3px 7px",
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
}

/* ── Empty state ──────────────────────────────────────────── */
function EmptyState({
  hasFilters,
  onReset,
  t,
}: {
  hasFilters: boolean;
  onReset: () => void;
  t: ReturnType<typeof import("../../lib/i18n").getTranslations>["home"];
}) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
      >
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none"
          stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round">
          <circle cx="8" cy="8" r="5.5"/>
          <path d="M13 13l3.5 3.5"/>
        </svg>
      </div>
      <div>
        <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{t.emptyTitle}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t.emptyHint}</p>
      </div>
      {hasFilters && (
        <button onClick={onReset} className="btn-cta text-[12px] font-semibold px-4 py-2 rounded-lg mt-1">
          {t.resetFilters}
        </button>
      )}
    </div>
  );
}
