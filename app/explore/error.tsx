"use client";

import { useEffect } from "react";

export default function ExploreError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[explore] render error:", error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center px-6" style={{ minHeight: "60vh" }}>
      <div className="text-center max-w-sm">
        <p className="uppercase tracking-widest font-semibold mb-3"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          Something went wrong
        </p>
        <h1 className="font-extrabold tracking-tight mb-3"
          style={{ fontSize: "clamp(1.4rem,4vw,1.8rem)", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
          Couldn't load festivals
        </h1>
        <p className="mb-6" style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6 }}>
          There was a problem connecting to the database. Your network is fine — this is on our end.
        </p>
        <button
          onClick={unstable_retry}
          className="btn-primary"
          style={{ fontSize: "13px" }}
        >
          Try again
        </button>
        {error.digest && (
          <p className="mt-4 font-mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            ref: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
