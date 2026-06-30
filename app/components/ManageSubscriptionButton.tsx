"use client";

import { useState } from "react";
import type { Language } from "../../lib/i18n/types";

export default function ManageSubscriptionButton({ lang }: { lang: Language }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="transition-opacity hover:opacity-70"
      style={{
        fontSize: "12.5px",
        color: "var(--text-muted)",
        background: "none",
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        padding: 0,
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading
        ? (lang === "fr" ? "Redirection…" : "Redirecting…")
        : (lang === "fr" ? "Gérer l'abonnement →" : "Manage subscription →")}
    </button>
  );
}
