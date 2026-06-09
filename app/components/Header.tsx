export default function Header() {
  return (
    <header
      className="sticky top-0 z-50 h-14 border-b border-[var(--border)]"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-screen-xl mx-auto px-6 h-full flex items-center gap-4">
        <div className="flex items-center gap-2 select-none">
          <span
            className="text-xl font-bold leading-none"
            style={{ color: "var(--accent)" }}
          >
            ◈
          </span>
          <span
            className="font-semibold tracking-tight"
            style={{ fontSize: "15px", color: "var(--text-primary)" }}
          >
            UberFestival
          </span>
        </div>

        <div className="flex-1" />

        <nav className="flex items-center gap-2">
          <button
            className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            Soumettre un festival
          </button>
          <button
            className="text-sm font-medium text-white px-4 py-1.5 rounded-lg transition-colors"
            style={{ background: "var(--accent)" }}
          >
            Connexion
          </button>
        </nav>
      </div>
    </header>
  );
}
