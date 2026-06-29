"use client";

export default function OpportunitiesFilters({
  genres,
  sortBy,
  genreFilter,
  countryFilter,
}: {
  genres: string[];
  sortBy: string;
  genreFilter: string | null;
  countryFilter: string | null;
}) {
  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <span style={{ fontSize: "12px", color: "var(--text-muted)", marginRight: 4 }}>Sort:</span>
      {(["deadline", "genre", "country"] as const).map((s) => (
        <a
          key={s}
          href={`/dashboard/opportunities?${new URLSearchParams({
            ...(genreFilter ? { genre: genreFilter } : {}),
            ...(countryFilter ? { country: countryFilter } : {}),
            sort: s,
          }).toString()}`}
          className="capitalize rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all"
          style={{
            background: sortBy === s ? "var(--accent)" : "rgba(0,0,0,0.05)",
            color: sortBy === s ? "#fff" : "var(--text-secondary)",
            textDecoration: "none",
          }}
        >
          {s === "deadline" ? "Deadline" : s === "genre" ? "Genre" : "Country"}
        </a>
      ))}

      {genres.length > 0 && (
        <>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: 8, marginRight: 4 }}>Genre:</span>
          <select
            className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium border"
            style={{
              background: genreFilter ? "var(--accent)" : "rgba(0,0,0,0.03)",
              color: genreFilter ? "#fff" : "var(--text-secondary)",
              borderColor: genreFilter ? "var(--accent)" : "var(--border)",
              cursor: "pointer",
            }}
            value={genreFilter ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const params = new URLSearchParams({
                ...(v ? { genre: v } : {}),
                ...(countryFilter ? { country: countryFilter } : {}),
                sort: sortBy,
              });
              window.location.href = `/dashboard/opportunities?${params.toString()}`;
            }}
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </>
      )}

      {(genreFilter || countryFilter) && (
        <a
          href={`/dashboard/opportunities?sort=${sortBy}`}
          className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium"
          style={{ color: "var(--text-muted)", textDecoration: "none" }}
        >
          Clear filters ×
        </a>
      )}
    </div>
  );
}
