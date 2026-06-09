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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const active = value !== "";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all"
        style={
          active
            ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
            : { background: "#fff", color: "var(--text-secondary)", borderColor: "var(--border)" }
        }
      >
        <span>{active ? value : label}</span>
        {active ? (
          <span
            className="opacity-70 hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            ×
          </span>
        ) : (
          <span className="opacity-40 text-xs">▾</span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 bg-white border border-[var(--border)] rounded-2xl z-40 min-w-48 py-1.5 overflow-hidden"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            Tout afficher
          </button>
          <div className="h-px bg-[var(--border)] mx-3 my-1" />
          <div className="max-h-56 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                style={{
                  color: value === opt ? "var(--accent)" : "var(--text-primary)",
                  fontWeight: value === opt ? 500 : 400,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
