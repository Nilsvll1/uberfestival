import Link from "next/link";
import type { Language } from "../../lib/i18n";
import { getTranslations } from "../../lib/i18n";
import { createClient } from "../../lib/supabase-server";
import LanguageSwitcher from "./LanguageSwitcher";
import MotionHeader from "./MotionHeader";
import LogoBrandmark from "./LogoBrandmark";
import UserMenu from "./UserMenu";

export default async function Header({ lang }: { lang: Language }) {
  const t = getTranslations(lang);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <LogoBrandmark name="UberFestival" href="/explore" />

        <div className="flex-1" />

        <nav className="flex items-center gap-2">
          <Link
            href="/explore"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full font-medium transition-colors hover:text-[var(--text-primary)]"
            style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "4px 10px" }}
          >
            {t.nav.explore}
          </Link>

          {/* Submit a festival — only show when logged out to keep header clean */}
          {!user && (
            <a
              href="mailto:submit@uberfestival.com?subject=Festival%20Submission"
              className="btn-nav-submit hidden sm:inline-flex items-center gap-1.5"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 2.5h8M2 5.5h5.5M2 8.5h7" />
              </svg>
              {t.nav.submit}
            </a>
          )}

          <LanguageSwitcher />
          <UserMenu user={user} />
        </nav>
      </div>
    </MotionHeader>
  );
}
