"use client";

export default function SaveButton({ label }: { label: string }) {
  return (
    <button
      className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ background: "rgba(255,255,255,0.93)", backdropFilter: "blur(8px)" }}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <svg
        width="12" height="12" viewBox="0 0 14 16" fill="none"
        stroke="#09090B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M2 2h10v12.5L7 10.5 2 14.5V2z" />
      </svg>
    </button>
  );
}
