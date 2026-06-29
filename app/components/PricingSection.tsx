"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useInView, AnimatePresence } from "motion/react";

const FEATURES = [
  "Access to 1,000+ festivals worldwide",
  "Verified festival profiles",
  "Festival descriptions and insights",
  "Festival application links",
  "Submission deadline tracking",
  "Unlimited favorites",
  "Advanced search filters",
  "Festival recommendations",
  "New opportunity alerts",
  "Worldwide festival map",
  "Continuous database updates",
  "Priority support",
];

const BENEFITS = [
  {
    label: "Access 1,000+ festivals worldwide",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    label: "Apply faster with verified links",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11.01" />
      </svg>
    ),
  },
  {
    label: "Never miss important deadlines",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12,6 12,12 16,14" />
      </svg>
    ),
  },
];

const TESTIMONIALS = [
  {
    id: 1,
    name: "Léa Dupont",
    role: "Electronic Producer",
    content:
      "Submitted to 8 festivals in one afternoon using the application links. What used to take me a week now takes a few hours.",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
  },
  {
    id: 2,
    name: "James Okafor",
    role: "Touring DJ",
    content:
      "The verified application links alone are worth it. No more hunting across three different websites just to find the submission form.",
    avatar: "https://randomuser.me/api/portraits/men/41.jpg",
  },
  {
    id: 3,
    name: "Sofia Martínez",
    role: "Jazz Vocalist",
    content:
      "The database is genuinely comprehensive. I found opportunities in countries I'd never thought to apply to — and got booked.",
    avatar: "https://randomuser.me/api/portraits/women/57.jpg",
  },
  {
    id: 4,
    name: "Dev Sharma",
    role: "Electronic Artist",
    content:
      "Found a festival in Southeast Asia I had no idea was accepting submissions. Applied, got selected. That single booking paid for years of subscription.",
    avatar: "https://randomuser.me/api/portraits/men/62.jpg",
  },
  {
    id: 5,
    name: "Yuki Tanaka",
    role: "Artist Manager",
    content:
      "I manage opportunities for five artists at once. The deadline tracking and saved lists make that manageable instead of a second full-time job.",
    avatar: "https://randomuser.me/api/portraits/women/33.jpg",
  },
];

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2,6 5,9 10,3" />
    </svg>
  );
}

export function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const [currentIdx, setCurrentIdx] = useState(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(
      () => setCurrentIdx((i) => (i + 1) % TESTIMONIALS.length),
      5000,
    );
    return () => clearInterval(id);
  }, []);

  const handleCheckout = useCallback(async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();

      if (res.status === 401 || data.error === "not_authenticated") {
        router.push("/login?redirectTo=/#pricing");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // network error — silently reset
    } finally {
      setCheckoutLoading(false);
    }
  }, [router]);

  return (
    <section
      ref={sectionRef}
      id="pricing"
      style={{ background: "#06060A", paddingTop: "5rem", paddingBottom: "6rem" }}
    >
      <div className="max-w-5xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6"
            style={{
              border: "1px solid rgba(99,102,241,0.20)",
              background: "rgba(99,102,241,0.06)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#818CF8" }}
            />
            <span
              className="font-medium uppercase"
              style={{ fontSize: "10.5px", color: "#818CF8", letterSpacing: "0.10em" }}
            >
              Early adopter pricing
            </span>
          </div>

          <h2
            className="font-extrabold tracking-tight mb-4"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              color: "#fff",
              letterSpacing: "-0.03em",
            }}
          >
            Unlock every festival opportunity.
          </h2>
          <p
            className="max-w-xl mx-auto leading-relaxed"
            style={{ fontSize: "15px", color: "rgba(255,255,255,0.38)" }}
          >
            Access verified festivals, application links, deadlines and opportunities from around the world.
          </p>
        </motion.div>

        {/* Pricing card */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: "#0E0E16",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 24px 64px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex flex-col md:flex-row">
              {/* ── Left column ── */}
              <div
                className="flex flex-col p-8 md:p-10 md:w-1/2"
                style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* Limited Time Offer badge */}
                <div className="mb-6">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold"
                    style={{
                      fontSize: "11px",
                      background: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.30)",
                      color: "#818CF8",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    Limited Time Offer
                  </span>
                </div>

                {/* Plan name & subtitle */}
                <h3
                  className="font-extrabold tracking-tight mb-1"
                  style={{ fontSize: "22px", color: "#fff", letterSpacing: "-0.02em" }}
                >
                  UberFestival Premium
                </h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.42)", marginBottom: "1.5rem" }}>
                  Discover, track and apply to festivals worldwide.
                </p>

                {/* Price */}
                <div className="mb-1 flex items-baseline gap-2">
                  <span
                    className="font-extrabold"
                    style={{ fontSize: "clamp(2.4rem, 5vw, 3rem)", color: "#fff", letterSpacing: "-0.04em" }}
                  >
                    $27
                  </span>
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>/year</span>
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "4px" }}>
                  Billed annually
                </p>
                <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.22)", marginBottom: "2rem" }}>
                  One year of premium access · Cancel anytime
                </p>

                {/* Benefits */}
                <div className="flex flex-col gap-3 mb-8">
                  {BENEFITS.map((b) => (
                    <div key={b.label} className="flex items-center gap-3">
                      <span style={{ color: "#818CF8", flexShrink: 0 }}>{b.svg}</span>
                      <span style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.60)" }}>{b.label}</span>
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                <div className="mt-auto flex flex-col gap-3">
                  <button
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-full font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      fontSize: "14.5px",
                      padding: "13px 24px",
                      background: "linear-gradient(135deg, #6366F1 0%, #5254E8 100%)",
                      color: "#fff",
                      boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
                      border: "none",
                      cursor: checkoutLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {checkoutLoading ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin" aria-hidden="true">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Redirecting…
                      </>
                    ) : (
                      <>
                        Get Premium Access
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2.5 9.5l7-7M4 2.5h5.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </>
                    )}
                  </button>

                  <Link
                    href="/explore"
                    className="w-full flex items-center justify-center gap-2 rounded-full font-medium transition-all hover:border-white/20 hover:text-white"
                    style={{
                      fontSize: "14px",
                      padding: "13px 24px",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.55)",
                      textDecoration: "none",
                    }}
                  >
                    Explore Festivals
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* ── Right column ── */}
              <div className="flex flex-col p-8 md:p-10 md:w-1/2">
                <p
                  className="font-semibold mb-5"
                  style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.09em" }}
                >
                  Included Features
                </p>

                <div className="flex flex-col gap-3 mb-8">
                  {FEATURES.map((feature, i) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: 16 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.3 + i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center gap-3"
                    >
                      <div
                        className="flex items-center justify-center rounded-full shrink-0"
                        style={{
                          width: "18px",
                          height: "18px",
                          background: "rgba(99,102,241,0.15)",
                          color: "#818CF8",
                        }}
                      >
                        <CheckIcon />
                      </div>
                      <span style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.60)" }}>
                        {feature}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Separator */}
                <div
                  style={{
                    height: "1px",
                    background: "rgba(255,255,255,0.06)",
                    marginBottom: "1.5rem",
                  }}
                />

                {/* Rotating testimonial */}
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    minHeight: "152px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                    padding: "1rem",
                  }}
                >
                  <AnimatePresence mode="wait">
                    {TESTIMONIALS.map(
                      (t, idx) =>
                        idx === currentIdx && (
                          <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -14 }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0 p-4 flex flex-col justify-between"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <img
                                src={t.avatar}
                                alt={t.name}
                                width={32}
                                height={32}
                                className="rounded-full object-cover shrink-0"
                                style={{ width: "32px", height: "32px" }}
                              />
                              <div className="min-w-0">
                                <p className="font-semibold truncate" style={{ fontSize: "13px", color: "#fff" }}>
                                  {t.name}
                                </p>
                                <p className="truncate" style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.38)" }}>
                                  {t.role}
                                </p>
                              </div>
                              <div className="ml-auto flex gap-0.5 shrink-0">
                                {[...Array(5)].map((_, i) => (
                                  <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill="#818CF8" aria-hidden="true">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                  </svg>
                                ))}
                              </div>
                            </div>
                            <p className="italic leading-relaxed" style={{ fontSize: "13px", color: "rgba(255,255,255,0.48)" }}>
                              &ldquo;{t.content}&rdquo;
                            </p>
                          </motion.div>
                        ),
                    )}
                  </AnimatePresence>
                </div>

                {/* Dot indicators */}
                <div className="flex justify-center gap-1.5 mt-4">
                  {TESTIMONIALS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIdx(i)}
                      aria-label={`Testimonial ${i + 1}`}
                      className="rounded-full transition-all"
                      style={{
                        height: "5px",
                        width: i === currentIdx ? "16px" : "5px",
                        background: i === currentIdx ? "#6366F1" : "rgba(255,255,255,0.18)",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
