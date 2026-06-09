"use client";

import { useEffect, useRef, useState } from "react";

export default function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const active = value !== "";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border transition-all"
        style={{
          fontSize: "13px",
          padding: "5px 12px",
          fontWeight: active ? 500 : 400,
          background:     active ? "var(--accent)"         : "#fff",
          color:          active ? "#fff"                   : "var(--text-secondary)",
          borderColor:    active ? "var(--accent)"          : "var(--border)",
          boxShadow:      active ? "0 1px 3px rgba(99,102,241,0.2)" : "var(--shadow-xs)",
          transition: "background 150ms, color 150ms, border-color 150ms, box-shadow 150ms",
        }}
      >
        <span>{active ? value : label}</span>
        {active ? (
          <span
            className="opacity-75 hover:opacity-100 text-xs leading-none"
            style={{ marginLeft: 2 }}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          >
            ×
          </span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="opacity-40">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {open && (
        <div
          className="dropdown-content absolute top-full left-0 mt-1.5 bg-white rounded-[14px] z-50 min-w-[180px] overflow-hidden py-1"
          style={{
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className="w-full text-left px-3.5 py-2 transition-colors hover:bg-[#F4F4F5]"
            style={{ fontSize: "13px", color: "var(--text-muted)" }}
          >
            Tout afficher
          </button>
          <div style={{ height: 1, background: "var(--border)", margin: "4px 12px" }} />
          <div className="max-h-56 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className="w-full text-left px-3.5 py-2 transition-colors hover:bg-[#F4F4F5] flex items-center justify-between gap-2"
                style={{
                  fontSize: "13px",
                  color: value === opt ? "var(--accent)" : "var(--text-primary)",
                  fontWeight: value === opt ? 500 : 400,
                }}
              >
                {opt}
                {value === opt && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
