import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase-server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import {
  approveStaging,
  rejectStaging,
  markFestivalVerified,
  addScrapeSource,
  addFestivalManually,
  toggleSource,
  addRssFeed,
  toggleRssFeed,
  deleteRssFeed,
  addFestivalPage,
  toggleFestivalPage,
  deleteFestivalPage,
} from "./actions";
import type { StagedFestival, ScrapeSource, RssFeed, PipelineRun } from "../../../lib/types";

export const metadata = { title: "Admin | UberFestival" };

export default async function AdminPage() {
  // ── Auth + admin guard ─────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim());
  if (!adminEmails.includes(user.email ?? "")) redirect("/dashboard");

  // Use the shared service-role client (no new instance per request)
  const db = supabaseAdmin;

  // ── Data fetching ──────────────────────────────────────────────────────────
  const [stagingRes, needsAttentionRes, sourcesRes, statsRes, rssFeedsRes, pipelineRunsRes, festivalPagesRes, linkHealthRes, coverageRes] = await Promise.all([
    db.from("festival_staging").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    db.from("festivals").select("id, festival_name, city, country, scrape_status, scrape_error, application_url, last_scraped_at")
      .in("scrape_status", ["dead_link", "failed", "manual_review"])
      .order("last_scraped_at", { ascending: true })
      .limit(50),
    db.from("scrape_sources").select("*").order("created_at"),
    Promise.all([
      db.from("festivals").select("id", { count: "exact", head: true }).neq("is_archived", true),
      db.from("festival_staging").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("festivals").select("id", { count: "exact", head: true }).eq("scrape_status", "dead_link"),
      db.from("festivals").select("id", { count: "exact", head: true }).eq("is_archived", true),
    ]),
    db.from("rss_feeds").select("*").order("created_at"),
    db.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(10),
    db.from("festival_pages").select("*").order("name"),
    Promise.all([
      db.from("festivals").select("id", { count: "exact", head: true }).not("application_url", "is", null).eq("is_archived", false),
      db.from("festivals").select("id", { count: "exact", head: true }).eq("link_check_status", "ok").eq("is_archived", false),
      db.from("festivals").select("id", { count: "exact", head: true })
        .in("link_check_status", ["not_found", "redirect_unrelated", "parked", "dead_domain", "timeout", "error"])
        .eq("is_archived", false),
      db.from("festivals")
        .select("id, festival_name, city, link_check_status, link_check_at, application_url")
        .in("link_check_status", ["not_found", "redirect_unrelated", "parked", "dead_domain", "timeout", "error"])
        .eq("is_archived", false)
        .order("link_check_at", { ascending: false })
        .limit(20),
    ]),
    Promise.all([
      db.from("festivals").select("id", { count: "exact", head: true }).eq("booking_model", "open_call").eq("is_archived", false),
      db.from("festivals").select("id", { count: "exact", head: true }).eq("booking_model", "invitation_only").eq("is_archived", false),
      db.from("festivals").select("id", { count: "exact", head: true }).eq("booking_model", "unknown").eq("is_archived", false),
    ]),
  ]);

  const staged: StagedFestival[] = (stagingRes.data ?? []) as StagedFestival[];
  const needsAttention = needsAttentionRes.data ?? [];
  const sources = sourcesRes.data ?? [];
  const rssFeeds: RssFeed[] = (rssFeedsRes.data ?? []) as RssFeed[];
  const pipelineRuns: PipelineRun[] = (pipelineRunsRes.data ?? []) as PipelineRun[];

  const [totalWithUrlRes, okLinksRes, brokenLinksRes, brokenListRes] = linkHealthRes;
  const totalWithUrl  = totalWithUrlRes.count ?? 0;
  const okLinks       = okLinksRes.count ?? 0;
  const brokenLinks   = brokenLinksRes.count ?? 0;
  const uncheckedLinks = totalWithUrl - okLinks - brokenLinks;
  const reliabilityPct = totalWithUrl > 0 ? Math.round((okLinks / totalWithUrl) * 100) : 0;
  const brokenLinkList = (brokenListRes.data ?? []) as Array<{
    id: number; festival_name: string; city: string | null;
    link_check_status: string; link_check_at: string | null; application_url: string;
  }>;
  const festivalPages = (festivalPagesRes.data ?? []) as Array<{
    id: number; name: string; url: string; category: string | null;
    last_hash: string | null; last_checked_at: string | null;
    last_open_at: string | null; is_active: boolean;
  }>;
  const [totalFestivals, pendingStaging, deadLinks, archivedCount] = statsRes;

  const [openCallRes, inviteOnlyRes, unknownRes] = coverageRes;
  const coverageOpenCall   = openCallRes.count ?? 0;
  const coverageInvite     = inviteOnlyRes.count ?? 0;
  const coverageUnknown    = unknownRes.count ?? 0;
  const coverageDenominator = coverageOpenCall + coverageUnknown;
  const coveragePct        = coverageDenominator > 0
    ? Math.round((coverageOpenCall / coverageDenominator) * 100) : 0;
  const coverageGap        = Math.max(0, Math.ceil(coverageDenominator * 0.8) - coverageOpenCall);

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
            <StatChip label="Live festivals" value={String(totalFestivals.count ?? 0)} />
            <StatChip label="Archived" value={String(archivedCount.count ?? 0)} />
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

        {/* ── Coverage ── */}
        <Section title="Application path coverage"
          subtitle="Effective coverage = open_call / (open_call + unknown). invitation_only festivals are excluded — they have no public application process.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-[12px] border px-4 py-2.5 text-center" style={{ background: "#fff", borderColor: "var(--border)" }}>
              <p className="font-extrabold tabular-nums"
                style={{ fontSize: "20px", letterSpacing: "-0.03em",
                  color: coveragePct >= 80 ? "#059669" : coveragePct >= 50 ? "#D97706" : "#DC2626" }}>
                {coveragePct}%
              </p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Coverage (target 80%)</p>
            </div>
            <div className="rounded-[12px] border px-4 py-2.5 text-center" style={{ background: "#fff", borderColor: "var(--border)" }}>
              <p className="font-extrabold tabular-nums" style={{ fontSize: "20px", color: "#059669", letterSpacing: "-0.03em" }}>{coverageOpenCall}</p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Open call (with path)</p>
            </div>
            <div className="rounded-[12px] border px-4 py-2.5 text-center" style={{ background: "#fff", borderColor: "var(--border)" }}>
              <p className="font-extrabold tabular-nums" style={{ fontSize: "20px", color: "var(--text-muted)", letterSpacing: "-0.03em" }}>{coverageUnknown}</p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Unknown (no path yet)</p>
            </div>
            <div className="rounded-[12px] border px-4 py-2.5 text-center" style={{ background: "#fff", borderColor: "var(--border)" }}>
              <p className="font-extrabold tabular-nums" style={{ fontSize: "20px", color: "var(--text-muted)", letterSpacing: "-0.03em" }}>{coverageInvite}</p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Invite-only (excluded)</p>
            </div>
          </div>
          {coverageGap > 0 && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {coverageGap} more application paths needed to reach 80% of {coverageDenominator} addressable festivals.
            </p>
          )}
        </Section>

        {/* ── Link health ── */}
        <Section title="Application link health"
          subtitle="Weekly validation status for every Premium application URL. Pipeline checks ~150 per run; run validate-apply-links.mjs for a full sweep.">

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-[12px] border px-4 py-2.5 text-center" style={{ background: "#fff", borderColor: "var(--border)" }}>
              <p className="font-extrabold tabular-nums" style={{ fontSize: "20px", color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{totalWithUrl}</p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>URLs total</p>
            </div>
            <div className="rounded-[12px] border px-4 py-2.5 text-center" style={{ background: "#fff", borderColor: "var(--border)" }}>
              <p className="font-extrabold tabular-nums" style={{ fontSize: "20px", color: "#059669", letterSpacing: "-0.03em" }}>{okLinks}</p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Working</p>
            </div>
            <div className="rounded-[12px] border px-4 py-2.5 text-center" style={{ background: "#fff", borderColor: "var(--border)" }}>
              <p className="font-extrabold tabular-nums" style={{ fontSize: "20px", color: brokenLinks > 0 ? "#DC2626" : "var(--text-primary)", letterSpacing: "-0.03em" }}>{brokenLinks}</p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Broken</p>
            </div>
            <div className="rounded-[12px] border px-4 py-2.5 text-center" style={{ background: "#fff", borderColor: "var(--border)" }}>
              <p className="font-extrabold tabular-nums" style={{ fontSize: "20px", color: reliabilityPct >= 95 ? "#059669" : reliabilityPct >= 80 ? "#D97706" : "#DC2626", letterSpacing: "-0.03em" }}>
                {totalWithUrl > 0 ? `${reliabilityPct}%` : "—"}
              </p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Reliability</p>
            </div>
          </div>

          {/* Unchecked note */}
          {uncheckedLinks > 0 && (
            <p className="mb-4" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {uncheckedLinks} URL{uncheckedLinks !== 1 ? "s" : ""} not yet checked by the validator — they will be prioritised in the next pipeline run.
            </p>
          )}

          {/* Broken links table */}
          {brokenLinkList.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
                    {["Festival", "Status", "Last checked", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold"
                        style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {brokenLinkList.map((f) => (
                    <tr key={f.id} style={{ borderBottom: "1px solid var(--border)", background: "#fff" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                        {f.festival_name}
                        {f.city && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {f.city}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <LinkStatusBadge status={f.link_check_status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        {f.link_check_at ? new Date(f.link_check_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <a href={f.application_url} target="_blank" rel="noopener noreferrer" className="btn-sm">
                          Check ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : totalWithUrl > 0 ? (
            <div className="rounded-2xl border py-10 text-center"
              style={{ borderColor: "var(--border)", borderStyle: "dashed", color: "var(--text-muted)", fontSize: "13.5px" }}>
              {uncheckedLinks > 0 ? "Awaiting first validation run." : "All application links are working."}
            </div>
          ) : (
            <Empty>No application URLs in the database yet.</Empty>
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

        {/* ── RSS feeds ── */}
        <Section title="RSS feeds"
          subtitle="Feeds the weekly pipeline ingests for new festival opportunities.">
          <div className="flex flex-col gap-2 mb-4">
            {rssFeeds.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl px-4 py-3 border"
                style={{ background: "#fff", borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>{f.name}</p>
                  <p className="truncate" style={{ fontSize: "12px", color: "var(--text-muted)" }}>{f.url}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {f.last_fetched_at && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {f.items_last_run} items · {new Date(f.last_fetched_at).toLocaleDateString()}
                    </span>
                  )}
                  <FeedStatusBadge status={f.last_fetch_status} />
                  <form action={toggleRssFeed.bind(null, f.id, !f.is_active)}>
                    <button type="submit" className="btn-sm" style={{ color: f.is_active ? "#059669" : "var(--text-muted)" }}>
                      {f.is_active ? "Active" : "Paused"}
                    </button>
                  </form>
                  <form action={deleteRssFeed.bind(null, f.id)}>
                    <button type="submit" className="btn-sm" style={{ color: "#DC2626" }}>Remove</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <form action={async (data: FormData) => {
            "use server";
            const name = data.get("name") as string;
            const url  = data.get("url")  as string;
            if (name && url) await addRssFeed(name, url);
          }} className="flex gap-2 flex-wrap">
            <input name="name" placeholder="Feed name" required className="input flex-1" style={{ minWidth: 160 }} />
            <input name="url" type="url" placeholder="https://example.com/feed.rss" required className="input flex-1" style={{ minWidth: 280 }} />
            <button type="submit" className="btn-primary">Add feed</button>
          </form>
        </Section>

        {/* ── Curated festival pages ── */}
        <Section title={`Curated festival pages (${festivalPages.length})`}
          subtitle="Official call-for-entry pages the weekly pipeline monitors for content changes. Only re-extracts when the page hash changes.">
          <div className="flex flex-col gap-2 mb-4">
            {festivalPages.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
                style={{ background: p.is_active ? "#fff" : "#fafafa", borderColor: "var(--border)", opacity: p.is_active ? 1 : 0.55 }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" style={{ fontSize: "13px", color: "var(--text-primary)" }}>{p.name}</span>
                    {p.category && (
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "10px", background: "var(--accent)18", color: "var(--accent)", fontWeight: 600 }}>
                        {p.category}
                      </span>
                    )}
                    {p.last_open_at && (
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "10px", background: "#05966918", color: "#059669", fontWeight: 600 }}>
                        open
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 flex-wrap mt-0.5" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-xs">{p.url}</a>
                    {p.last_checked_at && <span>Checked {new Date(p.last_checked_at).toLocaleDateString()}</span>}
                    {p.last_open_at && <span>Open {new Date(p.last_open_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={async () => { "use server"; await toggleFestivalPage(p.id, !p.is_active); }}>
                    <button type="submit" className="text-xs px-2.5 py-1 rounded-lg border"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "transparent" }}>
                      {p.is_active ? "Pause" : "Enable"}
                    </button>
                  </form>
                  <form action={async () => { "use server"; await deleteFestivalPage(p.id); }}>
                    <button type="submit" className="text-xs px-2.5 py-1 rounded-lg border"
                      style={{ borderColor: "#FCA5A5", color: "#DC2626", background: "transparent" }}>
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <form action={async (data: FormData) => {
            "use server";
            const name     = data.get("name") as string;
            const url      = data.get("url") as string;
            const category = data.get("category") as string;
            if (name && url) await addFestivalPage(name, url, category || undefined);
          }} className="flex gap-2 flex-wrap">
            <input name="name" placeholder="Page name" required
              className="flex-1 min-w-[160px] rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "#fff" }} />
            <input name="url" placeholder="https://..." required type="url"
              className="flex-[2] min-w-[220px] rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "#fff" }} />
            <select name="category"
              className="rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "#fff", color: "var(--text-primary)" }}>
              <option value="">category…</option>
              <option value="film">Film</option>
              <option value="music">Music</option>
              <option value="documentary">Documentary</option>
              <option value="screenwriting">Screenwriting</option>
              <option value="residency">Residency</option>
            </select>
            <button type="submit" className="btn-primary">Add page</button>
          </form>
        </Section>

        {/* ── Pipeline run history ── */}
        <Section title="Pipeline run history"
          subtitle="Last 10 weekly ingestion runs. Each Monday, the pipeline fetches all RSS feeds and updates the festival database.">
          {pipelineRuns.length === 0 ? (
            <Empty>No pipeline runs yet — the first run will happen next Monday at 07:00 UTC.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
                    {["#", "Started", "Status", "Feeds", "Found", "Created", "Updated", "Archived", "Errors", "Duration"].map((h) => (
                      <th key={h} className="px-3 py-3 text-left font-semibold"
                        style={{ fontSize: "10.5px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pipelineRuns.map((run) => (
                    <tr key={run.id} style={{ borderBottom: "1px solid var(--border)", background: "#fff" }}>
                      <td className="px-3 py-2.5 tabular-nums" style={{ fontSize: "12px", color: "var(--text-muted)" }}>#{run.id}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ fontSize: "12px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {new Date(run.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2.5"><RunStatusBadge status={run.status} /></td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ fontSize: "13px" }}>{run.feeds_processed}</td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ fontSize: "13px" }}>{run.items_found}</td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ fontSize: "13px", color: "#059669", fontWeight: run.festivals_created > 0 ? 600 : 400 }}>{run.festivals_created}</td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ fontSize: "13px" }}>{run.festivals_updated}</td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ fontSize: "13px", color: "var(--text-muted)" }}>{run.festivals_archived}</td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ fontSize: "13px", color: run.errors_count > 0 ? "#DC2626" : "var(--text-muted)" }}>{run.errors_count}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(0)}s` : run.status === "running" ? "…" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeedStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    ok: "#059669", failed: "#DC2626", empty: "#D97706", parse_error: "#DC2626",
  };
  return (
    <span className="rounded-full px-2 py-0.5 font-medium"
      style={{ fontSize: "10px", background: `${colors[status] ?? "#9CA3AF"}18`, color: colors[status] ?? "#9CA3AF" }}>
      {status}
    </span>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    completed: ["#059669", "completed"],
    failed:    ["#DC2626", "failed"],
    running:   ["#D97706", "running…"],
  };
  const [color, label] = map[status] ?? ["#9CA3AF", status];
  return (
    <span className="rounded-full px-2.5 py-0.5 font-medium"
      style={{ fontSize: "11px", background: `${color}18`, color }}>
      {label}
    </span>
  );
}

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

function LinkStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: "#059669",
    not_found: "#DC2626",
    redirect_unrelated: "#D97706",
    parked: "#DC2626",
    login_wall: "#D97706",
    expired: "#6366F1",
    dead_domain: "#DC2626",
    timeout: "#D97706",
    error: "#DC2626",
    unchecked: "#9CA3AF",
  };
  const labels: Record<string, string> = {
    not_found: "404",
    redirect_unrelated: "bad redirect",
    dead_domain: "dead domain",
    login_wall: "login wall",
  };
  const color = colors[status] ?? "#9CA3AF";
  const label = labels[status] ?? status?.replace(/_/g, " ");
  return (
    <span className="rounded-full px-2.5 py-0.5 font-medium"
      style={{ fontSize: "11px", background: `${color}18`, color }}>
      {label}
    </span>
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
