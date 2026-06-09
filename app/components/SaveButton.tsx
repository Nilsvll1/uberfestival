"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "uberfestival_saved";

function readSaved(): number[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeSaved(ids: number[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

export default function SaveButton({ label, festivalId }: { label: string; festivalId: number }) {
  const [saved, setSaved]     = useState(false);
  const [popped, setPopped]   = useState(false);

  useEffect(() => {
    setSaved(readSaved().includes(festivalId));
  }, [festivalId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaved(prev => {
      const ids   = readSaved();
      const next  = !prev;
      writeSaved(next ? [...ids.filter(i => i !== festivalId), festivalId] : ids.filter(i => i !== festivalId));
      return next;
    });
    setPopped(true);
    setTimeout(() => setPopped(false), 300);
  }

  return (
    <button
      className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      style={{
        background: saved ? "rgba(99,102,241,0.92)" : "rgba(255,255,255,0.93)",
        backdropFilter: "blur(8px)",
        transform: popped ? "scale(1.22)" : "scale(1)",
        transition: "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), background 160ms ease",
      }}
      aria-label={label}
      aria-pressed={saved}
      onClick={toggle}
    >
      <svg
        width="12" height="12" viewBox="0 0 14 16" fill="none"
        stroke={saved ? "#fff" : "#09090B"} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: "stroke 160ms ease" }}
      >
        <path d="M2 2h10v12.5L7 10.5 2 14.5V2z" fill={saved ? "#fff" : "none"} />
      </svg>
    </button>
  );
}
