"use client";

import { useEffect, useRef, useState } from "react";

export default function FilterDropdown({
  label,
  value,
  options,
  onChange,
  showAllLabel = "Show all",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  showAllLabel?: string;
}) {
  const [open, setOpen]           = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef              = useRef<HTMLDivElement>(null);
  const optionRefs                = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerRef                = useRef<HTMLButtonElement>(null);

  const total  = options.length + 1; // 0 = showAll, 1..n = options
  const active = value !== "";

  // Close on outside pointer-down; handle Escape + arrow keys
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx(i => (i + 1) % total);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx(i => (i - 1 + total) % total);
      }
      if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        onChange(activeIdx === 0 ? "" : options[activeIdx - 1]);
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, activeIdx, options, onChange, total]);

  // Move DOM focus to the highlighted option
  useEffect(() => {
    if (open && activeIdx >= 0) {
      optionRefs.current[activeIdx]?.focus();
    }
  }, [activeIdx, open]);

  // Reset highlight when dropdown closes
  useEffect(() => {
    if (!open) setActiveIdx(-1);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIdx(0);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border transition-all"
        style={{
          fontSize: "13px",
          padding: "5px 12px",
          fontWeight: active ? 500 : 400,
          background:  active ? "var(--accent)"                       : "#fff",
          color:       active ? "#fff"                                 : "var(--text-secondary)",
          borderColor: active ? "var(--accent)"                        : "var(--border)",
          boxShadow:   active ? "0 1px 3px rgba(99,102,241,0.2)"      : "var(--shadow-xs)",
          transition: "background 150ms, color 150ms, border-color 150ms, box-shadow 150ms",
        }}
      >
        <span>{active ? value : label}</span>
        {active ? (
          <span
            className="opacity-75 hover:opacity-100 text-xs leading-none"
            style={{ marginLeft: 2 }}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            aria-label="Clear filter"
          >
            ×
          </span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="opacity-40" aria-hidden="true">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="dropdown-content absolute top-full left-0 mt-1.5 bg-white rounded-[14px] z-50 min-w-[180px] overflow-hidden py-1"
          style={{
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <button
            ref={el => { optionRefs.current[0] = el; }}
            role="option"
            aria-selected={!active}
            onClick={() => { onChange(""); setOpen(false); }}
            className="w-full text-left px-3.5 py-2 transition-colors hover:bg-[#F4F4F5] focus:bg-[#F4F4F5] focus:outline-none"
            style={{ fontSize: "13px", color: "var(--text-muted)" }}
          >
            {showAllLabel}
          </button>
          <div style={{ height: 1, background: "var(--border)", margin: "4px 12px" }} />
          <div className="max-h-56 overflow-y-auto">
            {options.map((opt, i) => (
              <button
                key={opt}
                ref={el => { optionRefs.current[i + 1] = el; }}
                role="option"
                aria-selected={value === opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className="w-full text-left px-3.5 py-2 transition-colors hover:bg-[#F4F4F5] focus:bg-[#F4F4F5] focus:outline-none flex items-center justify-between gap-2"
                style={{
                  fontSize: "13px",
                  color:      value === opt ? "var(--accent)" : "var(--text-primary)",
                  fontWeight: value === opt ? 500 : 400,
                }}
              >
                {opt}
                {value === opt && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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
