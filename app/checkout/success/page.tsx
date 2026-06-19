import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Welcome to Premium | UberFestival",
};

export default function CheckoutSuccessPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 text-white"
      style={{ background: "#06060A" }}
    >
      {/* Glow */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 20%, rgba(99,102,241,0.18) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Image
            src="/logo-icon.png"
            alt="UberFestival"
            width={32}
            height={32}
            className="rounded-xl"
          />
          <span
            className="font-semibold tracking-tight"
            style={{ fontSize: "16px", color: "#fff" }}
          >
            UberFestival
          </span>
        </div>

        {/* Check icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.30)",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#818CF8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22,4 12,14.01 9,11.01" />
          </svg>
        </div>

        <h1
          className="font-extrabold tracking-tight mb-3"
          style={{
            fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
            color: "#fff",
            letterSpacing: "-0.03em",
          }}
        >
          You&apos;re in. Welcome to Premium.
        </h1>
        <p
          className="leading-relaxed mb-10"
          style={{ fontSize: "15px", color: "rgba(255,255,255,0.42)" }}
        >
          Your subscription is active. You now have access to 1,100+ verified
          festivals, application links, and deadline tracking — worldwide.
        </p>

        {/* What you unlocked */}
        <div
          className="rounded-2xl p-6 mb-8 text-left"
          style={{
            background: "#0E0E16",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <p
            className="font-semibold mb-4"
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              letterSpacing: "0.09em",
            }}
          >
            What you unlocked
          </p>
          <div className="flex flex-col gap-3">
            {[
              "Access to 1,100+ festivals worldwide",
              "Festival application links",
              "Submission deadline tracking",
              "Unlimited favorites",
              "Worldwide festival map",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: "18px",
                    height: "18px",
                    background: "rgba(99,102,241,0.15)",
                    color: "#818CF8",
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                </div>
                <span style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.60)" }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/explore"
            className="w-full flex items-center justify-center gap-2 rounded-full font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              fontSize: "14.5px",
              padding: "13px 24px",
              background: "linear-gradient(135deg, #6366F1 0%, #5254E8 100%)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
              textDecoration: "none",
            }}
          >
            Explore festivals
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2.5 9.5l7-7M4 2.5h5.5V8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center rounded-full font-medium transition-all"
            style={{
              fontSize: "14px",
              padding: "13px 24px",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.55)",
              textDecoration: "none",
            }}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
