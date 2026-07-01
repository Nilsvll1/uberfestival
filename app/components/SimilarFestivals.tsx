import Link from "next/link";
import FestivalCard from "./FestivalCard";
import { getSimilarFestivals } from "../../lib/recommendations";
import { getTranslations } from "../../lib/i18n";
import type { Language } from "../../lib/i18n/types";
import type { Festival } from "../../lib/types";

export default async function SimilarFestivals({
  festivalId,
  category,
  country,
  applicationStatus,
  savedIds,
  isPremium,
  userId,
  lang,
}: {
  festivalId: number;
  category: string | null;
  country: string | null;
  applicationStatus: string | null;
  savedIds: number[];
  isPremium: boolean | null;
  userId: string | null;
  lang: Language;
}) {
  const similar = await getSimilarFestivals(festivalId, category, country, applicationStatus);
  if (!similar.length) return null;

  const t = getTranslations(lang);

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p
            className="uppercase font-semibold tracking-[0.1em] mb-1"
            style={{ fontSize: "10px", color: "var(--text-muted)" }}
          >
            {t.festival.discover}
          </p>
          <h2
            className="font-semibold"
            style={{ fontSize: "18px", letterSpacing: "-0.02em", color: "var(--text-primary)" }}
          >
            {t.festival.similar}
          </h2>
        </div>
        <Link
          href="/explore"
          className="transition-opacity hover:opacity-60"
          style={{ fontSize: "13px", color: "var(--accent)" }}
        >
          {t.festival.viewAll}
        </Link>
      </div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {similar.map((f, i) => (
          <li key={f.id}>
            <FestivalCard
              festival={f as unknown as Festival}
              index={i}
              lang={lang}
              userId={userId}
              initialSaved={savedIds.includes(f.id)}
              isPremium={isPremium}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
