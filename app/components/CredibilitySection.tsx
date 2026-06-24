// No "use client" — CSS animation, fully server-renderable.

const FESTIVALS = [
  "SXSW",
  "Sundance",
  "Tribeca",
  "Berlinale",
  "Annecy",
  "TIFF",
  "Raindance",
  "Fantasia",
];

// Duplicated so the loop is invisible at the -50% seam.
const ITEMS = [...FESTIVALS, ...FESTIVALS];

const STATS = [
  { value: "1,100+", label: "Festivals" },
  { value: "48",     label: "Countries" },
  { value: "Weekly", label: "Updates"   },
];

export function CredibilitySection() {
  return (
    <section
      aria-label="Platform credibility"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        paddingBottom: "5rem",
      }}
    >

      {/* ── Marquee ──────────────────────────────────────────────── */}
      <div style={{ paddingTop: "3.5rem", paddingBottom: "3.5rem" }}>

        <p
          style={{
            textAlign: "center",
            fontSize: "10.5px",
            fontWeight: 600,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.18)",
            marginBottom: "1.75rem",
          }}
        >
          Including open calls from
        </p>

        {/* Edge-fade mask + overflow clip */}
        <div
          style={{
            overflow: "hidden",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)",
            maskImage:
              "linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)",
          }}
        >
          <div className="marquee-track" aria-hidden="true">
            {ITEMS.map((name, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 2.75rem",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    letterSpacing: "0.07em",
                    color: "rgba(255,255,255,0.30)",
                    textTransform: "uppercase" as const,
                  }}
                >
                  {name}
                </span>
                <span
                  style={{
                    marginLeft: "2.75rem",
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.10)",
                    lineHeight: 1,
                  }}
                >
                  /
                </span>
              </span>
            ))}
          </div>

          {/* Screen-reader accessible list (hidden visually) */}
          <ul
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              whiteSpace: "nowrap",
            }}
          >
            {FESTIVALS.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Stats + copy ─────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: "56rem",
          margin: "0 auto",
          padding: "0 1.5rem",
        }}
      >
        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "2.25rem 0",
          }}
        >
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              style={{
                textAlign: "center",
                borderRight:
                  i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                padding: "0 1.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: "#818CF8",
                  lineHeight: 1,
                  marginBottom: "0.45rem",
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.28)",
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Supporting copy */}
        <p
          style={{
            textAlign: "center",
            fontSize: "13.5px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.30)",
            maxWidth: "38rem",
            margin: "1.75rem auto 0",
          }}
        >
          New opportunities are automatically discovered, verified, enriched
          and added to the platform every week through our continuous data
          pipeline.
        </p>
      </div>

    </section>
  );
}
