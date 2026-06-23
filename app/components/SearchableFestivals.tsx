"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import type { Festival } from "../../lib/types";
import type { UrgencyGroup } from "../../lib/utils";
import { getUrgencyGroup } from "../../lib/utils";
import FestivalMapWrapper from "./FestivalMapWrapper";
import FilterDropdown from "./FilterDropdown";
import FestivalCard from "./FestivalCard";
import VirtualFestivalList, {
  type VirtualFestivalListHandle,
  type VirtualItem,
} from "./VirtualFestivalList";
import { useI18n } from "../hooks/useI18n";
import type { MapBounds } from "./FestivalMap";

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } },
};

type SortKey = "deadline" | "name";
type UrgencyTab = "all" | "week" | "month";

const URGENCY_ORDER: UrgencyGroup[] = ["this-week", "this-month", "upcoming", "no-deadline", "expired"];

function sortFestivals(festivals: Festival[], sort: SortKey, today: string): Festival[] {
  if (sort === "name")
    return [...festivals].sort((a, b) => a.festival_name.localeCompare(b.festival_name));
  return [...festivals].sort((a, b) => {
    const da = a.submission_deadline?.slice(0, 10) ?? null;
    const db = b.submission_deadline?.slice(0, 10) ?? null;
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    const aFuture = da >= today, bFuture = db >= today;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return aFuture ? da.localeCompare(db) : db.localeCompare(da);
  });
}

export default function SearchableFestivals({
  festivals,
  userId = null,
  savedIds = [],
  today,
  isPremium = null,
}: {
  festivals: Festival[];
  userId?: string | null;
  today: string;
  savedIds?: number[];
  isPremium?: boolean | null;
}) {
  const { lang, t } = useI18n();
  const h = t.home;

  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const [query,       setQuery]       = useState(() => searchParams.get("q")       ?? "");
  const [country,     setCountry]     = useState(() => searchParams.get("country") ?? "");
  const [category,    setCategory]    = useState(() => searchParams.get("genre")   ?? "");
  const [sort,        setSort]        = useState<SortKey>("deadline");
  const [urgencyTab,  setUrgencyTab]  = useState<UrgencyTab>("all");
  const [hoveredId,        setHoveredId]        = useState<number | null>(null);
  const [mapBounds,        setMapBounds]        = useState<MapBounds | null>(null);
  const [showAllInViewport, setShowAllInViewport] = useState(false);

  const searchRef      = useRef<HTMLInputElement>(null);
  const mobileSearch   = useRef<HTMLInputElement>(null);
  const desktopListRef = useRef<VirtualFestivalListHandle>(null);
  const didMount       = useRef(false);

  const countries   = useMemo(() => [...new Set(festivals.map(f => f.country).filter(Boolean))].sort() as string[], [festivals]);
  const categories  = useMemo(() => [...new Set(festivals.map(f => f.category).filter(Boolean))].sort() as string[], [festivals]);
  const uniqueCountriesCount = useMemo(() => new Set(festivals.map(f => f.country).filter(Boolean)).size, [festivals]);

  // Base filter (search + dropdowns, no urgency tab)
  const baseFiltered = useMemo(() => festivals.filter(f => {
    const matchName    = query.trim() === "" || f.festival_name.toLowerCase().includes(query.toLowerCase());
    const matchCountry = country   === "" || f.country   === country;
    const matchCat     = category  === "" || f.category  === category;
    return matchName && matchCountry && matchCat;
  }), [festivals, query, country, category]);

  // Tab counts (reflect base filters so users see relevant counts)
  const weekCount  = useMemo(() => baseFiltered.filter(f => getUrgencyGroup(f.submission_deadline, today) === "this-week").length, [baseFiltered, today]);
  const monthCount = useMemo(() => baseFiltered.filter(f => {
    const g = getUrgencyGroup(f.submission_deadline, today);
    return g === "this-week" || g === "this-month";
  }).length, [baseFiltered, today]);

  // Final filtered list — applies urgency tab on top of base
  const filtered = useMemo(() => {
    let base = baseFiltered;
    if (urgencyTab === "week") {
      base = base.filter(f => getUrgencyGroup(f.submission_deadline, today) === "this-week");
    } else if (urgencyTab === "month") {
      base = base.filter(f => {
        const g = getUrgencyGroup(f.submission_deadline, today);
        return g === "this-week" || g === "this-month";
      });
    }
    return sortFestivals(base, sort, today);
  }, [baseFiltered, urgencyTab, sort, today]);

  // Groups for the "all" tab grouped view (only when sort === "deadline")
  const groups = useMemo(() => {
    if (urgencyTab !== "all" || sort !== "deadline") return null;
    const map = new Map<UrgencyGroup, Festival[]>();
    for (const f of filtered) {
      const g = getUrgencyGroup(f.submission_deadline, today);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return URGENCY_ORDER.filter(g => map.has(g)).map(g => ({ key: g, items: map.get(g)! }));
  }, [filtered, urgencyTab, sort, today]);

  // Filter sidebar to festivals currently visible in the map viewport.
  // The map itself always shows all `filtered` festivals (for clustering).
  // Antimeridian wrap: when east < west the view crosses the 180° meridian.
  const viewportFiltered = useMemo(() => {
    if (!mapBounds) return filtered;
    const { north, south, east, west } = mapBounds;
    return filtered.filter(f => {
      if (!f.latitude || !f.longitude) return false;
      if (f.latitude < south || f.latitude > north) return false;
      return east >= west
        ? f.longitude >= west && f.longitude <= east
        : f.longitude >= west || f.longitude <= east;
    });
  }, [filtered, mapBounds]);

  // Zoom-based cap: limits sidebar items at wide zoom levels to reduce render work.
  // Reset "show all" whenever the viewport changes (zoom/pan) — the cap may be different.
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(prev => {
      if (prev && Math.round(prev.zoom) !== Math.round(bounds.zoom)) setShowAllInViewport(false);
      return bounds;
    });
  }, []);

  const sidebarCap = useMemo((): number | null => {
    const zoom = mapBounds?.zoom ?? 2;
    if (zoom <= 3) return 50;
    if (zoom <= 5) return 75;
    if (zoom <= 7) return 100;
    return null;
  }, [mapBounds?.zoom]);

  const isCapped = !showAllInViewport && sidebarCap !== null && viewportFiltered.length > sidebarCap;

  // Apply cap: prioritise urgency order (viewportFiltered is already sorted by deadline).
  const displayedFestivals = useMemo(
    () => (isCapped && sidebarCap ? viewportFiltered.slice(0, sidebarCap) : viewportFiltered),
    [viewportFiltered, isCapped, sidebarCap],
  );

  // Groups for viewport-filtered festivals (mirrors `groups` logic but on displayedFestivals).
  const viewportGroups = useMemo(() => {
    if (urgencyTab !== "all" || sort !== "deadline") return null;
    const map = new Map<UrgencyGroup, Festival[]>();
    for (const f of displayedFestivals) {
      const g = getUrgencyGroup(f.submission_deadline, today);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return URGENCY_ORDER.filter(g => map.has(g)).map(g => ({ key: g, items: map.get(g)! }));
  }, [displayedFestivals, urgencyTab, sort, today]);

  // Flat items array for the desktop virtual list (uses viewport-filtered data).
  const virtualItems = useMemo<VirtualItem[]>(() => {
    if (viewportGroups) {
      const items: VirtualItem[] = [];
      for (const group of viewportGroups) {
        items.push({
          type: "header",
          label: h.urgencyGroups[
            group.key === "this-week"   ? "thisWeek"  :
            group.key === "this-month"  ? "thisMonth" :
            group.key === "upcoming"    ? "upcoming"  :
            group.key === "no-deadline" ? "noDeadline" :
            "expired"
          ],
          count: group.items.length,
          isHot: group.key === "this-week",
        });
        for (let i = 0; i < group.items.length; i++) {
          items.push({ type: "card", festival: group.items[i], listIndex: i });
        }
      }
      return items;
    }
    return displayedFestivals.map((festival, i) => ({ type: "card", festival, listIndex: i }));
  }, [viewportGroups, displayedFestivals, h.urgencyGroups]);


  const hasFilters = query.trim() !== "" || country !== "" || category !== "" || urgencyTab !== "all";

  const reset = useCallback(() => {
    setQuery(""); setCountry(""); setCategory(""); setUrgencyTab("all");
  }, []);

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

  // Scroll the virtual list to show the hovered card (when hover comes from map)
  useEffect(() => {
    if (hoveredId === null) return;
    desktopListRef.current?.scrollToFestival(hoveredId);
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
            onBoundsChange={handleBoundsChange}
          />
        </div>

        {/* Glass panel */}
        <div
          className="absolute top-0 left-0 h-full flex flex-col"
          style={{
            width: 420,
            zIndex: 450,
            background: "rgba(249,249,251,0.92)",
            backdropFilter: "blur(16px) saturate(150%)",
            WebkitBackdropFilter: "blur(16px) saturate(150%)",
            borderRight: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "12px 0 48px rgba(0,0,0,0.07)",
          }}
        >
          {/* ── Panel header ─────────────────────────────────── */}
          <div className="shrink-0 px-6 pt-6 pb-5">

            {/* Full logo — hero branding */}
            <div className="mb-5">
              <Image
                src="/logo-cropped.png"
                alt="UberFestival"
                width={176}
                height={29}
                priority
                style={{ objectFit: "contain", objectPosition: "left" }}
              />
            </div>

            {/* Live indicator + urgency alert */}
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
              {weekCount > 0 && (
                <>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>·</span>
                  <button
                    onClick={() => setUrgencyTab("week")}
                    className="flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ fontSize: "10px", color: "#DC2626", fontWeight: 600 }}
                  >
                    <span style={{ fontSize: 8 }}>●</span>
                    {h.closingSoon(weekCount)}
                  </button>
                </>
              )}
            </div>

            {/* Tagline — static or contextual when filters active */}
            {(() => {
              const lines = hasFilters
                ? h.contextTagline(filtered.length, category, country)
                : h.tagline;
              return (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h1
                    key={hasFilters ? `ctx-${category}-${country}-${filtered.length}` : "default"}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="font-extrabold leading-[1.04]"
                    style={{ fontSize: "28px", letterSpacing: "-0.04em", color: "var(--text-primary)" }}
                  >
                    {lines[0]}<br />
                    <span style={{ color: "var(--accent)" }}>{lines[1]}</span>
                  </motion.h1>
                </AnimatePresence>
              );
            })()}

            {/* Platform descriptor */}
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 5 }}>
              {h.platform}
            </p>

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

            {/* Result count: "Showing 50 of 1,106" or "X in view" or plain filter count */}
            {(hasFilters || hasSomeHover || (mapBounds && viewportFiltered.length < filtered.length) || isCapped) && (
              <p className="mt-3 flex items-center gap-2 flex-wrap" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                <span>
                  {isCapped ? (
                    <>
                      {"Showing "}
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {displayedFestivals.length.toLocaleString()}
                      </span>
                      {" of "}
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {viewportFiltered.length.toLocaleString()}
                      </span>
                      {viewportFiltered.length < filtered.length ? ` ${t.festival.inView}` : " festivals"}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {viewportFiltered.length < filtered.length ? viewportFiltered.length : filtered.length}
                      </span>
                      {" "}
                      {viewportFiltered.length < filtered.length
                        ? t.festival.inView
                        : h.opportunities(filtered.length)}
                    </>
                  )}
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
            {/* Urgency tabs */}
            <div
              className="flex items-center gap-0.5 p-1 rounded-xl mb-3"
              style={{ background: "rgba(0,0,0,0.04)" }}
            >
              {(["all", "week", "month"] as UrgencyTab[]).map(tab => {
                const label =
                  tab === "all"   ? h.urgencyTabs.all :
                  tab === "week"  ? h.urgencyTabs.thisWeek(weekCount) :
                  h.urgencyTabs.thisMonth(monthCount);
                const isHot = tab === "week" && weekCount > 0;
                return (
                  <button
                    key={tab}
                    onClick={() => setUrgencyTab(tab)}
                    className="flex-1 text-center rounded-lg transition-all"
                    style={{
                      fontSize: "11.5px",
                      padding: "5px 6px",
                      fontWeight: urgencyTab === tab ? 600 : 400,
                      background: urgencyTab === tab ? "#fff" : "transparent",
                      color: urgencyTab === tab
                        ? (isHot ? "#DC2626" : "var(--text-primary)")
                        : "var(--text-muted)",
                      boxShadow: urgencyTab === tab ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
                      transition: "background 150ms, color 150ms, box-shadow 150ms",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

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
              <FilterDropdown label={h.country}  value={country}  options={countries}  onChange={setCountry}  showAllLabel={h.showAll} />
              <FilterDropdown label={h.genre}    value={category} options={categories} onChange={setCategory} showAllLabel={h.showAll} />
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

          {/* ── Scrollable list (virtualized) ─────────────────── */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="relative flex-1 min-h-0">
              {filtered.length === 0 ? (
                <div className="h-full overflow-y-auto px-4 py-3">
                  <EmptyState hasFilters={hasFilters} onReset={reset} t={t.home} />
                </div>
              ) : viewportFiltered.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {t.festival.zoomOut}
                  </p>
                </div>
              ) : (
                <VirtualFestivalList
                  ref={desktopListRef}
                  items={virtualItems}
                  hoveredId={hoveredId}
                  hasSomeHover={hasSomeHover}
                  userId={userId}
                  savedIds={savedIds}
                  lang={lang}
                  isPremium={isPremium}
                  onHoverChange={setHoveredId}
                />
              )}
              {/* Scroll fade */}
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0"
                style={{
                  height: isCapped ? 0 : 64,
                  background: "linear-gradient(to bottom, rgba(249,249,251,0) 0%, rgba(249,249,251,0.98) 100%)",
                }}
              />
            </div>

            {/* Show-all footer — only visible when a zoom cap is in effect */}
            {isCapped && (
              <button
                onClick={() => setShowAllInViewport(true)}
                className="shrink-0 w-full transition-colors hover:bg-black/[0.03] active:bg-black/[0.06]"
                style={{
                  borderTop: "1px solid rgba(0,0,0,0.07)",
                  padding: "10px 16px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  letterSpacing: "0.01em",
                }}
              >
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Show all {viewportFiltered.length.toLocaleString()}
                </span>
                {" "}· {viewportFiltered.length < filtered.length ? "in view" : "festivals"}
              </button>
            )}
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
          {/* Urgency tabs — mobile */}
          <div
            className="flex items-center gap-0.5 p-1 rounded-xl mt-2"
            style={{ background: "rgba(0,0,0,0.04)" }}
          >
            {(["all", "week", "month"] as UrgencyTab[]).map(tab => {
              const label =
                tab === "all"   ? h.urgencyTabs.all :
                tab === "week"  ? h.urgencyTabs.thisWeek(weekCount) :
                h.urgencyTabs.thisMonth(monthCount);
              return (
                <button
                  key={tab}
                  onClick={() => setUrgencyTab(tab)}
                  className="flex-1 text-center rounded-lg transition-all"
                  style={{
                    fontSize: "11.5px",
                    padding: "5px 6px",
                    fontWeight: urgencyTab === tab ? 600 : 400,
                    background: urgencyTab === tab ? "#fff" : "transparent",
                    color: urgencyTab === tab
                      ? (tab === "week" && weekCount > 0 ? "#DC2626" : "var(--text-primary)")
                      : "var(--text-muted)",
                    boxShadow: urgencyTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <FilterDropdown label={h.country}  value={country}  options={countries}  onChange={setCountry}  showAllLabel={h.showAll} />
            <FilterDropdown label={h.genre}    value={category} options={categories} onChange={setCategory} showAllLabel={h.showAll} />
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
            {" "}{h.opportunities(filtered.length)}
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
            <motion.ul
              key={`mobile-${query}-${country}-${category}-${sort}`}
              className="grid gap-3 sm:grid-cols-2"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {filtered.map((festival, index) => (
                <motion.li key={festival.id} variants={itemVariants}>
                  <FestivalCard
                    festival={festival}
                    index={index}
                    lang={lang}
                    userId={userId}
                    initialSaved={savedIds.includes(festival.id)}
                    isPremium={isPremium}
                  />
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Urgency group header ─────────────────────────────────── */
function GroupHeader({ label, count, isHot }: { label: string; count: number; isHot: boolean }) {
  return (
    <div className="flex items-center gap-2 px-1 pt-2 pb-1">
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.07em",
          color: isHot ? "#DC2626" : "var(--text-muted)",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {isHot && <span style={{ marginRight: 4 }}>●</span>}{label}
      </span>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 500,
          padding: "1px 6px",
          borderRadius: 99,
          background: isHot ? "rgba(220,38,38,0.08)" : "rgba(0,0,0,0.05)",
          color: isHot ? "#DC2626" : "var(--text-muted)",
        }}
      >
        {count}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
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
