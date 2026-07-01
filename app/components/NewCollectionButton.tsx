"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCollection } from "../actions/collections";

export default function NewCollectionButton({ lang }: { lang: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setName("");
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createCollection(name);
      if (result.error) { setError(result.error); return; }
      router.push(`/dashboard/collections/${result.id}`);
    });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="h-full min-h-[88px] w-full rounded-[16px] border-2 border-dashed flex items-center justify-center gap-2 transition-all hover:border-indigo-400"
        style={{ borderColor: "var(--border)", background: "transparent", cursor: "pointer" }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 1v8M1 5h8" />
          </svg>
        </span>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
          {lang === "fr" ? "Nouvelle collection" : "New collection"}
        </span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[16px] border p-4 flex flex-col gap-3"
      style={{
        background: "#fff",
        borderColor: "rgba(99,102,241,0.3)",
        boxShadow: "0 0 0 3px rgba(99,102,241,0.07)",
      }}
    >
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={lang === "fr" ? "Nom de la collection" : "Collection name"}
        maxLength={100}
        className="input-search w-full rounded-[9px] border"
        style={{ fontSize: "13.5px", padding: "8px 12px", borderColor: "var(--border)", color: "var(--text-primary)" }}
      />
      {error && <p style={{ fontSize: "12px", color: "#DC2626" }}>{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="btn-cta rounded-[9px] font-semibold"
          style={{ fontSize: "13px", padding: "7px 14px", opacity: isPending || !name.trim() ? 0.6 : 1 }}
        >
          {isPending
            ? (lang === "fr" ? "Création…" : "Creating…")
            : (lang === "fr" ? "Créer" : "Create")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-[9px] transition-colors hover:bg-gray-100"
          style={{ fontSize: "13px", padding: "7px 14px", color: "var(--text-muted)" }}
        >
          {lang === "fr" ? "Annuler" : "Cancel"}
        </button>
      </div>
    </form>
  );
}
