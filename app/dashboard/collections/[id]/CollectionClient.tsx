"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Festival, Collection } from "../../../../lib/types";
import type { Language } from "../../../../lib/i18n";
import FestivalCard from "../../../components/FestivalCard";
import {
  renameCollection,
  deleteCollection,
  addToCollection,
  removeFromCollection,
  moveToCollection,
  toggleCollectionPublic,
  exportCollectionCSV,
} from "../../../actions/collections";
import type { CollectionFestivalForClient, SavedFestivalForAdd } from "./page";

const APPLICATION_METHODS = [
  { status: "verified_application", label: "Verified" },
  { status: "filmfreeway",          label: "FilmFreeway" },
  { status: "festhome",             label: "Festhome" },
  { status: "email_submission",     label: "Email" },
  { status: "contact_form",         label: "Form" },
  { status: "invitation_only",      label: "Invite Only" },
] as const;

function collectionGradient(name: string): string {
  const gs = [
    "linear-gradient(90deg,#818CF8,#6366F1)",
    "linear-gradient(90deg,#34D399,#059669)",
    "linear-gradient(90deg,#F472B6,#EC4899)",
    "linear-gradient(90deg,#FBBF24,#F59E0B)",
    "linear-gradient(90deg,#60A5FA,#3B82F6)",
    "linear-gradient(90deg,#A78BFA,#7C3AED)",
  ];
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return gs[h % gs.length];
}

export default function CollectionClient({
  collection: initialCollection,
  initialItems,
  availableToAdd: initialAvailable,
  savedFestivalIds,
  otherCollections,
  userId,
  isPremium,
  lang,
}: {
  collection: Collection;
  initialItems: CollectionFestivalForClient[];
  availableToAdd: SavedFestivalForAdd[];
  savedFestivalIds: number[];
  otherCollections: { id: string; name: string }[];
  userId: string;
  isPremium: boolean;
  lang: Language;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [collection, setCollection] = useState(initialCollection);
  const [items, setItems] = useState(initialItems);

  const [filterCountry, setFilterCountry] = useState("");
  const [filterGenre,   setFilterGenre]   = useState("");
  const [filterMethod,  setFilterMethod]  = useState("");

  const [renaming,     setRenaming]     = useState(false);
  const [newName,      setNewName]      = useState(collection.name);
  const [renameError,  setRenameError]  = useState<string | null>(null);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addSearch,    setAddSearch]    = useState("");

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareCopied,    setShareCopied]    = useState(false);

  const [moveMenuId, setMoveMenuId] = useState<number | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Close move menu on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest("[data-move-menu]")) setMoveMenuId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────

  const filteredItems = items.filter(f => {
    const matchCountry = !filterCountry || f.country === filterCountry;
    const matchGenre   = !filterGenre   || f.category === filterGenre;
    const matchMethod  = !filterMethod  || f.application_status === filterMethod;
    return matchCountry && matchGenre && matchMethod;
  });

  const inCollectionIds = new Set(items.map(f => f.id));

  const availableFiltered = initialAvailable
    .filter(f => !inCollectionIds.has(f.id))
    .filter(f =>
      !addSearch ||
      f.festival_name.toLowerCase().includes(addSearch.toLowerCase()) ||
      (f.city ?? "").toLowerCase().includes(addSearch.toLowerCase())
    );

  const countries = [...new Set(items.map(f => f.country).filter(Boolean))].sort() as string[];
  const genres    = [...new Set(items.map(f => f.category).filter(Boolean))].sort() as string[];
  const hasFilters = filterCountry || filterGenre || filterMethod;

  // ── Action handlers ───────────────────────────────────────────────────────

  function handleStartRename() {
    setNewName(collection.name);
    setRenaming(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  function handleRename() {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === collection.name) {
      setRenaming(false);
      setRenameError(null);
      return;
    }
    setRenameError(null);
    startTransition(async () => {
      const result = await renameCollection(collection.id, trimmed);
      if (result.error) { setRenameError(result.error); return; }
      setCollection(c => ({ ...c, name: trimmed }));
      setRenaming(false);
    });
  }

  function handleAddFestival(festival: SavedFestivalForAdd) {
    if (inCollectionIds.has(festival.id)) return;
    // Optimistic add.
    setItems(prev => [
      {
        ...festival,
        submission_deadline: "",
        latitude: 0,
        longitude: 0,
        has_apply_url: false,
        added_at: new Date().toISOString(),
      } as CollectionFestivalForClient,
      ...prev,
    ]);
    startTransition(async () => {
      const result = await addToCollection(collection.id, festival.id);
      if (result.error) {
        // Revert.
        setItems(prev => prev.filter(f => f.id !== festival.id));
      }
    });
  }

  function handleRemoveFestival(festivalId: number) {
    const snapshot = items.find(f => f.id === festivalId);
    setItems(prev => prev.filter(f => f.id !== festivalId));
    startTransition(async () => {
      const result = await removeFromCollection(collection.id, festivalId);
      if (result.error && snapshot) setItems(prev => [...prev, snapshot]);
    });
  }

  function handleMoveFestival(festivalId: number, toCollectionId: string) {
    setMoveMenuId(null);
    const snapshot = items.find(f => f.id === festivalId);
    setItems(prev => prev.filter(f => f.id !== festivalId));
    startTransition(async () => {
      const result = await moveToCollection(collection.id, festivalId, toCollectionId);
      if (result.error && snapshot) setItems(prev => [...prev, snapshot]);
    });
  }

  function handleTogglePublic() {
    startTransition(async () => {
      const result = await toggleCollectionPublic(collection.id);
      if (!result.error) setCollection(c => ({ ...c, is_public: result.isPublic! }));
    });
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/c/${collection.slug}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  function handleExportCSV() {
    startTransition(async () => {
      const result = await exportCollectionCSV(collection.id);
      if (!result.csv) return;
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${collection.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCollection(collection.id);
      if (!result.error) router.push("/dashboard");
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-[960px] mx-auto px-5 lg:px-8 py-10 lg:py-14">

      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 mb-8 transition-opacity hover:opacity-60"
        style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "none" }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11L5 7l4-4"/>
        </svg>
        {lang === "fr" ? "Tableau de bord" : "Dashboard"}
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* Color strip */}
          <div
            className="w-8 h-1 rounded-full mb-3"
            style={{ background: collectionGradient(collection.name) }}
          />

          {renaming ? (
            <div>
              <form
                onSubmit={e => { e.preventDefault(); handleRename(); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={nameInputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onBlur={handleRename}
                  maxLength={100}
                  className="input-search rounded-[10px] border font-extrabold"
                  style={{
                    fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
                    letterSpacing: "-0.04em",
                    padding: "4px 10px",
                    color: "var(--text-primary)",
                    borderColor: "rgba(99,102,241,0.4)",
                    background: "rgba(99,102,241,0.04)",
                    width: "100%",
                    maxWidth: 480,
                  }}
                />
              </form>
              {renameError && (
                <p style={{ fontSize: "12px", color: "#DC2626", marginTop: 4 }}>{renameError}</p>
              )}
            </div>
          ) : (
            <button
              onClick={handleStartRename}
              className="text-left group/rename"
              aria-label={lang === "fr" ? "Renommer la collection" : "Rename collection"}
              style={{ background: "none", border: "none", padding: 0, cursor: "text" }}
            >
              <h1
                className="font-extrabold leading-tight"
                style={{
                  fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
                  letterSpacing: "-0.04em",
                  color: "var(--text-primary)",
                }}
              >
                {collection.name}
                <span
                  className="ml-2 opacity-0 group-hover/rename:opacity-40 transition-opacity"
                  style={{ fontSize: "0.55em" }}
                >
                  ✏
                </span>
              </h1>
            </button>
          )}

          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 4 }}>
            {items.length}{" "}
            {lang === "fr"
              ? `festival${items.length !== 1 ? "s" : ""}`
              : `festival${items.length !== 1 ? "s" : ""}`}
            {collection.is_public && (
              <span style={{ color: "var(--accent)" }}>
                {" · "}{lang === "fr" ? "Collection publique" : "Public collection"}
              </span>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setShowSharePanel(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-sm font-medium transition-all hover:shadow-sm"
            style={{
              fontSize: "13px",
              color: showSharePanel ? "var(--accent)" : "var(--text-secondary)",
              borderColor: showSharePanel ? "rgba(99,102,241,0.35)" : "var(--border)",
              background: showSharePanel ? "rgba(99,102,241,0.05)" : "#fff",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10.5" cy="3" r="1.5"/><circle cx="3.5" cy="7" r="1.5"/><circle cx="10.5" cy="11" r="1.5"/>
              <path d="M5 7.9l4 2.1M5 6.1l4-2.1"/>
            </svg>
            {lang === "fr" ? "Partager" : "Share"}
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isPending || items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-sm font-medium transition-all hover:shadow-sm"
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              borderColor: "var(--border)",
              background: "#fff",
              opacity: items.length === 0 ? 0.5 : 1,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1v8M4 6l3 3 3-3"/><path d="M2 11h10"/>
            </svg>
            CSV
          </button>
        </div>
      </div>

      {/* ── Share panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSharePanel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="rounded-[16px] border p-5 mb-8 flex flex-col gap-4"
            style={{ background: "#fff", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold" style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
                  {lang === "fr" ? "Lien public" : "Public sharing"}
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>
                  {lang === "fr"
                    ? "Toute personne ayant le lien peut voir cette collection."
                    : "Anyone with the link can view this collection."}
                </p>
              </div>
              {/* Toggle */}
              <button
                role="switch"
                aria-checked={collection.is_public}
                onClick={handleTogglePublic}
                disabled={isPending}
                className="relative shrink-0 w-10 h-6 rounded-full transition-colors"
                style={{ background: collection.is_public ? "var(--accent)" : "rgba(0,0,0,0.12)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: collection.is_public ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {collection.is_public && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/c/${collection.slug}` : ""}
                  className="flex-1 rounded-[9px] border text-sm"
                  style={{
                    fontSize: "12.5px",
                    padding: "8px 12px",
                    color: "var(--text-secondary)",
                    borderColor: "var(--border)",
                    background: "rgba(0,0,0,0.02)",
                  }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-2 font-medium transition-all hover:shadow-sm shrink-0"
                  style={{
                    fontSize: "13px",
                    borderColor: shareCopied ? "rgba(22,163,74,0.4)" : "var(--border)",
                    color: shareCopied ? "#16A34A" : "var(--text-secondary)",
                    background: shareCopied ? "rgba(22,163,74,0.05)" : "#fff",
                  }}
                >
                  {shareCopied
                    ? (lang === "fr" ? "Copié !" : "Copied!")
                    : (lang === "fr" ? "Copier" : "Copy link")}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <FilterSelect
            value={filterCountry}
            onChange={setFilterCountry}
            options={countries}
            placeholder={lang === "fr" ? "Pays" : "Country"}
          />
          <FilterSelect
            value={filterGenre}
            onChange={setFilterGenre}
            options={genres}
            placeholder={lang === "fr" ? "Genre" : "Genre"}
          />
          <select
            value={filterMethod}
            onChange={e => setFilterMethod(e.target.value)}
            className="rounded-[10px] border appearance-none"
            style={{
              fontSize: "13px",
              padding: "7px 28px 7px 12px",
              color: filterMethod ? "var(--text-primary)" : "var(--text-muted)",
              borderColor: filterMethod ? "rgba(99,102,241,0.5)" : "var(--border)",
              background: filterMethod ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.9)",
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' strokeWidth='1.5' strokeLinecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              cursor: "pointer",
            }}
          >
            <option value="">{lang === "fr" ? "Méthode" : "Method"}</option>
            {APPLICATION_METHODS.map(m => (
              <option key={m.status} value={m.status}>{m.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={() => { setFilterCountry(""); setFilterGenre(""); setFilterMethod(""); }}
              className="inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-60"
              style={{ fontSize: "12.5px", color: "var(--text-muted)" }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1.5 1.5l8 8M9.5 1.5l-8 8"/>
              </svg>
              {lang === "fr" ? "Effacer" : "Clear"}
            </button>
          )}
        </div>
      )}

      {/* ── Count + Add button ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          {filteredItems.length}{hasFilters && ` / ${items.length}`}{" "}
          {lang === "fr"
            ? `festival${filteredItems.length !== 1 ? "s" : ""}`
            : `festival${filteredItems.length !== 1 ? "s" : ""}`}
        </p>
        <button
          onClick={() => setShowAddPanel(true)}
          className="inline-flex items-center gap-1.5 font-semibold transition-opacity hover:opacity-70"
          style={{ fontSize: "13px", color: "var(--accent)" }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M6.5 1v11M1 6.5h11"/>
          </svg>
          {lang === "fr" ? "Ajouter des festivals" : "Add festivals"}
        </button>
      </div>

      {/* ── Festival grid ────────────────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <div
          className="rounded-[18px] border flex flex-col items-center justify-center gap-4 py-16 text-center"
          style={{ borderColor: "var(--border)", background: "#fff", borderStyle: "dashed" }}
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="5.5" height="5.5" rx="1.5"/>
              <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.5"/>
              <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.5"/>
              <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.5"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
              {hasFilters
                ? (lang === "fr" ? "Aucun résultat pour ces filtres" : "No festivals match these filters")
                : (lang === "fr" ? "Cette collection est vide" : "This collection is empty")}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 4 }}>
              {hasFilters
                ? (lang === "fr" ? "Essaie d'autres filtres." : "Try different filters.")
                : (lang === "fr" ? "Ajoute des festivals depuis ta liste sauvegardée." : "Add festivals from your saved list.")}
            </p>
          </div>
          {!hasFilters && (
            <button
              onClick={() => setShowAddPanel(true)}
              className="btn-cta inline-flex items-center gap-2 font-semibold rounded-[11px] px-4 py-2.5"
              style={{ fontSize: "13px" }}
            >
              {lang === "fr" ? "Ajouter des festivals" : "Add festivals"}
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(f => (
            <div key={f.id} className="relative group/col-item">
              <FestivalCard
                festival={f as Festival}
                lang={lang}
                userId={userId}
                initialSaved={savedFestivalIds.includes(f.id)}
                isPremium={isPremium}
              />
              {/* Collection-specific overlay */}
              <div
                className="absolute bottom-0 inset-x-0 rounded-b-[18px] flex items-center justify-between gap-2 px-3 py-2.5
                  opacity-0 group-hover/col-item:opacity-100 transition-opacity pointer-events-none group-hover/col-item:pointer-events-auto"
                style={{
                  background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.12) 100%)",
                }}
              >
                <button
                  onClick={() => handleRemoveFestival(f.id)}
                  className="inline-flex items-center gap-1 font-medium transition-opacity hover:opacity-70"
                  style={{ fontSize: "12px", color: "rgba(255,255,255,0.9)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1.5 1.5l8 8M9.5 1.5l-8 8"/>
                  </svg>
                  {lang === "fr" ? "Retirer" : "Remove"}
                </button>

                {otherCollections.length > 0 && (
                  <div className="relative" data-move-menu>
                    <button
                      onClick={() => setMoveMenuId(id => id === f.id ? null : f.id)}
                      className="inline-flex items-center gap-1 font-medium transition-opacity hover:opacity-70"
                      style={{ fontSize: "12px", color: "rgba(255,255,255,0.9)" }}
                    >
                      {lang === "fr" ? "Déplacer vers" : "Move to"}
                      <svg width="10" height="10" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 1l4 4 4-4"/>
                      </svg>
                    </button>
                    {moveMenuId === f.id && (
                      <div
                        className="absolute bottom-full right-0 mb-1.5 rounded-[12px] border overflow-hidden"
                        style={{
                          background: "rgba(250,250,251,0.98)",
                          backdropFilter: "blur(24px)",
                          borderColor: "rgba(0,0,0,0.1)",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                          minWidth: 170,
                          zIndex: 50,
                        }}
                      >
                        <div className="p-1">
                          {otherCollections.map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleMoveFestival(f.id, c.id)}
                              className="w-full text-left px-3 py-2 rounded-[8px] transition-colors hover:bg-black/5"
                              style={{ fontSize: "13px", color: "var(--text-primary)" }}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Danger zone ─────────────────────────────────────────────────── */}
      <div
        className="mt-16 pt-8 flex flex-col gap-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <p
          className="uppercase font-semibold tracking-[0.1em]"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}
        >
          {lang === "fr" ? "Zone dangereuse" : "Danger zone"}
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="self-start inline-flex items-center gap-2 rounded-[10px] border px-4 py-2.5 font-medium transition-all hover:shadow-sm"
            style={{ fontSize: "13px", color: "#DC2626", borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.04)" }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.5 8h7l.5-8"/>
            </svg>
            {lang === "fr" ? "Supprimer la collection" : "Delete collection"}
          </button>
        ) : (
          <div
            className="rounded-[14px] border p-5 flex flex-col gap-4"
            style={{ borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.03)" }}
          >
            <p style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
              {lang === "fr"
                ? `Supprimer "${collection.name}" ? Cette action est irréversible. Les festivals ne seront pas supprimés.`
                : `Delete "${collection.name}"? This cannot be undone. Festivals won't be deleted.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-[10px] font-semibold px-4 py-2.5 transition-opacity"
                style={{ fontSize: "13px", color: "#fff", background: "#DC2626", opacity: isPending ? 0.7 : 1 }}
              >
                {lang === "fr" ? "Supprimer définitivement" : "Delete permanently"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-[10px] px-4 py-2.5 font-medium transition-colors hover:bg-gray-100"
                style={{ fontSize: "13px", color: "var(--text-muted)" }}
              >
                {lang === "fr" ? "Annuler" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add festivals panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddPanel && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0"
              style={{ background: "rgba(0,0,0,0.3)", zIndex: 490 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddPanel(false); setAddSearch(""); }}
            />
            {/* Panel */}
            <motion.div
              className="fixed top-0 right-0 h-full flex flex-col"
              style={{
                width: "min(400px, 100vw)",
                background: "#fff",
                boxShadow: "-8px 0 48px rgba(0,0,0,0.18)",
                zIndex: 500,
              }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <h2 className="font-semibold" style={{ fontSize: "15px", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  {lang === "fr" ? "Ajouter des festivals" : "Add festivals"}
                </h2>
                <button
                  onClick={() => { setShowAddPanel(false); setAddSearch(""); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
                  style={{ color: "var(--text-muted)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1.5 1.5l8 8M9.5 1.5l-8 8"/>
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-3 shrink-0">
                <input
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  placeholder={lang === "fr" ? "Rechercher…" : "Search saved festivals…"}
                  className="input-search w-full rounded-[10px] border"
                  style={{ fontSize: "13.5px", padding: "9px 14px", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  autoFocus
                />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                {availableFiltered.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", fontWeight: 500 }}>
                      {addSearch
                        ? (lang === "fr" ? "Aucun résultat" : "No results")
                        : (lang === "fr" ? "Tous tes festivals sauvegardés sont dans cette collection" : "All your saved festivals are in this collection")}
                    </p>
                    {!addSearch && (
                      <Link
                        href="/explore"
                        onClick={() => setShowAddPanel(false)}
                        className="text-sm font-medium transition-opacity hover:opacity-70"
                        style={{ color: "var(--accent)", textDecoration: "none" }}
                      >
                        {lang === "fr" ? "Découvrir d'autres festivals →" : "Discover more festivals →"}
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 pt-1">
                    {availableFiltered.map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleAddFestival(f)}
                        disabled={inCollectionIds.has(f.id)}
                        className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-left transition-colors hover:bg-gray-50"
                        style={{ cursor: inCollectionIds.has(f.id) ? "default" : "pointer" }}
                      >
                        {f.hero_image_url ? (
                          <img
                            src={f.hero_image_url}
                            alt=""
                            className="w-9 h-9 rounded-[8px] object-cover shrink-0"
                            style={{ border: "1px solid var(--border)" }}
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-[8px] shrink-0 flex items-center justify-center"
                            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.12)" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round">
                              <circle cx="7" cy="6" r="4.5"/>
                              <path d="M7 10.5v2M4.5 12.5h5"/>
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
                            {f.festival_name}
                          </p>
                          <p className="truncate" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {[f.city, f.country].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        {inCollectionIds.has(f.id) ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8l3.5 3.5 7-7"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M7 1v12M1 7h12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-[10px] border appearance-none"
      style={{
        fontSize: "13px",
        padding: "7px 28px 7px 12px",
        color: value ? "var(--text-primary)" : "var(--text-muted)",
        borderColor: value ? "rgba(99,102,241,0.5)" : "var(--border)",
        background: value ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.9)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' strokeWidth='1.5' strokeLinecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        cursor: "pointer",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
