import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="flex-1 flex flex-col items-center justify-center px-5"
      style={{ minHeight: "60vh" }}
    >
      <div className="text-center" style={{ maxWidth: 380 }}>
        {/* Logo mark */}
        <div
          className="inline-flex items-center justify-center rounded-[10px] mb-8 mx-auto"
          style={{
            width: 40,
            height: 40,
            background: "linear-gradient(145deg, #818CF8 0%, #6366F1 55%, #5254E8 100%)",
            boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
          }}
        >
          <svg width="20" height="15" viewBox="0 0 13 10" fill="none">
            <path d="M1 1.5H12"  stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M1 5H8.5"   stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M1 8.5H10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        <p
          className="font-semibold uppercase tracking-widest mb-3"
          style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.1em" }}
        >
          404
        </p>
        <h1
          className="font-extrabold"
          style={{
            fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
            letterSpacing: "-0.04em",
            color: "var(--text-primary)",
            marginBottom: 10,
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: "14.5px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          This festival doesn&apos;t exist or may have been removed.
        </p>

        <Link
          href="/"
          className="btn-cta inline-flex items-center gap-2 font-semibold rounded-[11px]"
          style={{ fontSize: "13.5px", padding: "10px 20px" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M8 10L4 6l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Discover festivals
        </Link>
      </div>
    </main>
  );
}
