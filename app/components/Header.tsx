import type { Language } from "../../lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import MotionHeader from "./MotionHeader";
import LogoBrandmark from "./LogoBrandmark";

export default function Header({ lang }: { lang: Language }) {
  return (
    <MotionHeader
      className="sticky top-0 z-50 h-[52px] border-b"
      style={{
        background: "rgba(250,250,251,0.82)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <div className="max-w-screen-xl mx-auto px-5 h-full flex items-center gap-3">
        <LogoBrandmark name="UberFestival" />

        <div className="flex-1" />

        <nav className="flex items-center gap-2">
          <span
            className="font-semibold uppercase tracking-wider"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.06em",
              padding: "3px 7px",
              borderRadius: "5px",
              background: "rgba(99,102,241,0.08)",
              color: "var(--accent)",
            }}
          >
            Beta
          </span>
          <LanguageSwitcher />
        </nav>
      </div>
    </MotionHeader>
  );
}
