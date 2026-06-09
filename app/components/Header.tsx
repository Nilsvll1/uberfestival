import type { Language } from "../../lib/i18n";
import { getTranslations } from "../../lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header({ lang }: { lang: Language }) {
  const t = getTranslations(lang);

  return (
    <header
      className="sticky top-0 z-50 h-[52px] border-b"
      style={{
        background: "rgba(250,250,251,0.82)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <div className="max-w-screen-xl mx-auto px-5 h-full flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5 select-none">
          <div
            className="flex items-center justify-center rounded-[7px] shrink-0"
            style={{
              width: 26,
              height: 26,
              background: "linear-gradient(145deg, #818CF8 0%, #6366F1 55%, #5254E8 100%)",
              boxShadow: "0 1px 3px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
              <path d="M1 1.5H12"   stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M1 5H8.5"    stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M1 8.5H10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span
            className="font-semibold tracking-tight"
            style={{ fontSize: "14.5px", letterSpacing: "-0.015em", color: "var(--text-primary)" }}
          >
            UberFestival
          </span>
        </div>

        <div className="flex-1" />

        <nav className="flex items-center gap-1.5">
          <button className="btn-ghost px-3 py-1.5 rounded-lg">
            {t.nav.submit}
          </button>
          <button
            className="btn-cta text-sm font-medium px-3.5 py-1.5 rounded-lg"
            style={{ fontSize: "13px" }}
          >
            {t.nav.login}
          </button>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
