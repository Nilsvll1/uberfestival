"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, type Language } from "../../lib/i18n";
import { useI18n } from "../hooks/useI18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  function select(code: Language) {
    setOpen(false);
    if (code !== lang) setLang(code);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg transition-colors"
        style={{
          fontSize: "12px",
          fontWeight: 500,
          padding: "4px 8px",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
          background: open ? "#F4F4F5" : "transparent",
          letterSpacing: "0.04em",
        }}
        aria-label="Change language"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <circle cx="8" cy="8" r="6.5"/>
          <path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5"/>
          <path d="M8 1.5C10 4 11 6 11 8s-1 4-3 6.5"/>
          <path d="M1.5 8h13"/>
        </svg>
        {current.flag}
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className="opacity-50">
          <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="dropdown-content absolute top-full right-0 mt-1.5 bg-white rounded-[12px] overflow-hidden py-1 z-50"
          style={{
            minWidth: 130,
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => select(l.code)}
              className="w-full text-left flex items-center justify-between gap-3 px-3.5 py-2 transition-colors hover:bg-[#F4F4F5]"
              style={{
                fontSize: "13px",
                color: l.code === lang ? "var(--accent)" : "var(--text-primary)",
                fontWeight: l.code === lang ? 500 : 400,
              }}
            >
              <span>{l.label}</span>
              {l.code === lang && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
