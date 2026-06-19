import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Checkout Cancelled | UberFestival",
};

export default function CheckoutCancelPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 text-white"
      style={{ background: "#06060A" }}
    >
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

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.40)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
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
          No worries.
        </h1>
        <p
          className="leading-relaxed mb-10"
          style={{ fontSize: "15px", color: "rgba(255,255,255,0.42)" }}
        >
          Your checkout was cancelled. You haven&apos;t been charged.
          <br />
          You can upgrade to Premium anytime.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/#pricing"
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
            View pricing
          </Link>
          <Link
            href="/explore"
            className="w-full flex items-center justify-center rounded-full font-medium transition-all"
            style={{
              fontSize: "14px",
              padding: "13px 24px",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.55)",
              textDecoration: "none",
            }}
          >
            Explore festivals
          </Link>
        </div>
      </div>
    </main>
  );
}
