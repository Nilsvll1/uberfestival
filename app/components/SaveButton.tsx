"use client";

import { useEffect, useState } from "react";
import { toggleSaveFestival } from "../actions/auth";

const STORAGE_KEY = "uberfestival_saved";

function readSaved(): number[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeSaved(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

export default function SaveButton({
  label,
  festivalId,
  userId = null,
  initialSaved = false,
}: {
  label: string;
  festivalId: number;
  userId?: string | null;
  initialSaved?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [popped, setPopped] = useState(false);
  const [pending, setPending] = useState(false);

  // For anonymous users, read localStorage as source of truth.
  useEffect(() => {
    if (userId) return;
    setSaved(readSaved().includes(festivalId));
  }, [festivalId, userId]);

  // Keep in sync when initialSaved prop changes (e.g. after server revalidation).
  useEffect(() => {
    if (userId) setSaved(initialSaved);
  }, [initialSaved, userId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    const next = !saved;
    setSaved(next);
    setPopped(true);
    setTimeout(() => setPopped(false), 300);

    if (userId) {
      setPending(true);
      const result = await toggleSaveFestival(festivalId, saved);
      setPending(false);
      if (result?.error) setSaved(saved); // revert on error
    } else {
      const ids = readSaved();
      writeSaved(
        next
          ? [...ids.filter((i) => i !== festivalId), festivalId]
          : ids.filter((i) => i !== festivalId)
      );
    }
  }

  return (
    <button
      className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
      style={{
        background: saved ? "rgba(99,102,241,0.92)" : "rgba(255,255,255,0.93)",
        backdropFilter: "blur(8px)",
        transform: popped ? "scale(1.22)" : "scale(1)",
        transition:
          "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), background 160ms ease, opacity 160ms ease",
      }}
      aria-label={label}
      aria-pressed={saved}
      onClick={toggle}
      disabled={pending}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 14 16"
        fill="none"
        stroke={saved ? "#fff" : "#09090B"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "stroke 160ms ease" }}
      >
        <path d="M2 2h10v12.5L7 10.5 2 14.5V2z" fill={saved ? "#fff" : "none"} />
      </svg>
    </button>
  );
}
