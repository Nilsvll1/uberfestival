import FestivalCard from "./FestivalCard";
import { getPeopleAlsoSaved } from "../../lib/recommendations";
import type { Language } from "../../lib/i18n/types";
import type { Festival } from "../../lib/types";

export default async function PeopleAlsoSaved({
  festivalId,
  savedIds,
  isPremium,
  userId,
  lang,
}: {
  festivalId: number;
  savedIds: number[];
  isPremium: boolean | null;
  userId: string | null;
  lang: Language;
}) {
  const festivals = await getPeopleAlsoSaved(festivalId);
  if (!festivals.length) return null;

  const label = lang === "fr" ? "Les artistes sauvegardent aussi" : "People also saved";

  return (
    <section className="mt-10">
      <div className="mb-5">
        <p
          className="uppercase font-semibold tracking-[0.1em] mb-1"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}
        >
          {lang === "fr" ? "Découvrir" : "Discover"}
        </p>
        <h2
          className="font-semibold"
          style={{ fontSize: "18px", letterSpacing: "-0.02em", color: "var(--text-primary)" }}
        >
          {label}
        </h2>
      </div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {festivals.map((f, i) => (
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
