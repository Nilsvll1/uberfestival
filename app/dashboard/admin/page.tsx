import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  approveStaging,
  rejectStaging,
  markFestivalVerified,
  addScrapeSource,
  addFestivalManually,
  toggleSource,
} from "./actions";
import type { StagedFestival, ScrapeSource } from "../../../lib/types";

export const metadata = { title: "Admin | UberFestival" };

// Service client for reads (admin page only — key kept server-side).
function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function AdminPage() {
  // ── Auth + admin guard ─────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim());
  if (!adminEmails.includes(user.email ?? "")) redirect("/dashboard");

  const db = serviceDb();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const [stagingRes, needsAttentionRes, sourcesRes, statsRes] = await Promise.all([
    db.from("festival_staging").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    db.from("festivals").select("id, festival_name, city, country, scrape_status, scrape_error, application_url, last_scraped_at")
      .in("scrape_status", ["dead_link", "failed", "manual_review"])
      .order("last_scraped_at", { ascending: true })
      .limit(50),
    db.from("scrape_sources").select("*").order("created_at"),
    Promise.all([
      db.from("festivals").select("id", { count: "exact", head: true }),
      db.from("festival_staging").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("festivals").select("id", { count: "exact", head: true }).eq("scrape_status", "dead_link"),
    ]),
  ]);

  const staged: StagedFestival[] = (stagingRes.data ?? []) as StagedFestival[];
  const needsAttention = needsAttentionRes.data ?? [];
  const sources = sourcesRes.data ?? [];
  const [totalFestivals, pendingStaging, deadLinks] = statsRes;

  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="uppercase tracking-widest font-semibold mb-1"
              style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              Admin
            </p>
            <h1 className="font-extrabold tracking-tight"
              style={{ fontSize: "clamp(1.4rem,3vw,2rem)", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
              Festival Data
            </h1>
          </div>
          <div className="flex gap-3 flex-wrap">
            <StatChip label="Total festivals" value={String(totalFestivals.count ?? 0)} />
            <StatChip label="Pending review" value={String(pendingStaging.count ?? 0)} accent />
            <StatChip label="Dead links" value={String(deadLinks.count ?? 0)} warn />
          </div>
        </div>

        {/* ── Staging queue ── */}
        <Section title={`Staging queue (${staged.length})`}
          subtitle="Auto-discovered festivals waiting for your review. Approve to publish, reject to discard.">
          {staged.length === 0 ? (
            <Empty>No pending discoveries — the scraper hasn't found anything new yet.</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {staged.map((item) => (
                <StagingCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </Section>

        {/* ── Needs attention ── */}
        <Section title={`Needs attention (${needsAttention.length})`}
          subtitle="Festivals with dead links, scrape failures, or missing deadlines.">
          {needsAttention.length === 0 ? (
            <Empty>All clear.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
                    {["Festival", "Status", "Error", "Last checked", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold"
                        style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {needsAttention.map((f) => (
                    <tr key={f.id} style={{ borderBottom: "1px solid var(--border)", background: "#fff" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                        {f.festival_name}
                        {f.city && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {f.city}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={f.scrape_status} />
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)", maxWidth: 200 }}>
                        <span className="truncate block">{f.scrape_error ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        {f.last_scraped_at ? new Date(f.last_scraped_at).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {f.application_url && (
                            <a href={f.application_url} target="_blank" rel="noopener noreferrer"
                              className="btn-sm">Open ↗</a>
                          )}
                          <form action={markFestivalVerified.bind(null, f.id)}>
                            <button type="submit" className="btn-sm">Mark OK</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── Scrape sources ── */}
        <Section title="Scrape sources"
          subtitle="Pages the scraper crawls to discover new festival listings.">
          <div className="flex flex-col gap-2 mb-4">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl px-4 py-3 border"
                style={{ background: "#fff", borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>{s.name}</p>
                  <p className="truncate" style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.url}</p>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {s.last_scraped_at ? `Last: ${new Date(s.last_scraped_at).toLocaleDateString()}` : "Not yet run"}
                </span>
                <form action={toggleSource.bind(null, s.id, !s.is_active)}>
                  <button type="submit" className="btn-sm" style={{ color: s.is_active ? "#059669" : "var(--text-muted)" }}>
                    {s.is_active ? "Active" : "Paused"}
                  </button>
                </form>
              </div>
            ))}
          </div>

          <form action={async (data: FormData) => {
            "use server";
            const name = data.get("name") as string;
            const url = data.get("url") as string;
            if (name && url) await addScrapeSource(name, url);
          }} className="flex gap-2 flex-wrap">
            <input name="name" placeholder="Source name" required className="input flex-1" style={{ minWidth: 160 }} />
            <input name="url" type="url" placeholder="https://..." required className="input flex-1" style={{ minWidth: 260 }} />
            <button type="submit" className="btn-primary">Add source</button>
          </form>
        </Section>

        {/* ── Add festival manually ── */}
        <Section title="Add festival manually"
          subtitle="Adds directly to the live database, marked as verified.">
          <form action={async (data: FormData) => {
            "use server";
            await addFestivalManually({
              festival_name: data.get("festival_name") as string,
              country: (data.get("country") as string) || undefined,
              city: (data.get("city") as string) || undefined,
              genre: (data.get("genre") as string) || undefined,
              application_url: (data.get("application_url") as string) || undefined,
              submission_deadline: (data.get("submission_deadline") as string) || undefined,
              website: (data.get("website") as string) || undefined,
            });
          }} className="grid sm:grid-cols-2 gap-3">
            <input name="festival_name" placeholder="Festival name *" required className="input" />
            <input name="website" type="url" placeholder="Website" className="input" />
            <input name="city" placeholder="City" className="input" />
            <input name="country" placeholder="Country" className="input" />
            <input name="genre" placeholder="Genre" className="input" />
            <input name="application_url" type="url" placeholder="Application URL" className="input" />
            <input name="submission_deadline" placeholder="Deadline (YYYY-MM-DD)" className="input" />
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">Add festival</button>
            </div>
          </form>
        </Section>

      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StagingCard({ item }: { item: StagedFestival }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: "#fff", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="font-semibold mb-1" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
            {item.festival_name ?? "Unknown festival"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {item.city && <span>{item.city}{item.country ? `, ${item.country}` : ""}</span>}
            {item.genre && <span>{item.genre}</span>}
            {item.submission_deadline && <span>Deadline: {item.submission_deadline}</span>}
          </div>
          <a href={item.source_url} target="_blank" rel="noopener noreferrer"
            className="hover:underline"
            style={{ fontSize: "11px", color: "var(--accent)", display: "block", marginTop: 4 }}>
            {item.source_url.slice(0, 80)}
          </a>
          {item.raw_text && (
            <p className="mt-2 line-clamp-2" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {item.raw_text.slice(0, 200)}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <form action={approveStaging.bind(null, item.id, {})}>
            <button type="submit" className="btn-primary" style={{ fontSize: "12px", padding: "6px 14px" }}>
              Approve
            </button>
          </form>
          <form action={rejectStaging.bind(null, item.id)}>
            <button type="submit" className="btn-sm" style={{ color: "#DC2626" }}>
              Reject
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-bold mb-1" style={{ fontSize: "16px", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="mb-4" style={{ fontSize: "13px", color: "var(--text-muted)" }}>{subtitle}</p>
      )}
      {children}
    </section>
  );
}

function StatChip({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  const color = warn ? "#DC2626" : accent ? "var(--accent)" : "var(--text-primary)";
  return (
    <div className="rounded-[12px] border px-4 py-2.5 text-center"
      style={{ background: "#fff", borderColor: "var(--border)", minWidth: 110 }}>
      <p className="font-extrabold tabular-nums" style={{ fontSize: "20px", color, letterSpacing: "-0.03em" }}>{value}</p>
      <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    dead_link: "#DC2626",
    failed: "#D97706",
    manual_review: "#6366F1",
    ok: "#059669",
    pending: "#6B7280",
  };
  return (
    <span className="rounded-full px-2.5 py-0.5 font-medium"
      style={{ fontSize: "11px", background: `${colors[status] ?? "#6B7280"}18`, color: colors[status] ?? "#6B7280" }}>
      {status?.replace("_", " ")}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border py-10 text-center"
      style={{ borderColor: "var(--border)", borderStyle: "dashed", color: "var(--text-muted)", fontSize: "13.5px" }}>
      {children}
    </div>
  );
}
