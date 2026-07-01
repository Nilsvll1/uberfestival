"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "../../actions/auth";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword]   = useState("");
  const [confirm,  setConfirm]    = useState("");
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState<string | null>(null);
  const [done,     setDone]       = useState(false);

  // After success, redirect to dashboard after a brief confirmation.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => router.replace("/dashboard"), 2500);
    return () => clearTimeout(t);
  }, [done, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setDone(true);
  }

  return (
    <div
      className="w-full rounded-[22px] p-8 sm:p-10"
      style={{ maxWidth: 420, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(145deg, #4ade80 0%, #16a34a 100%)", boxShadow: "0 4px 16px rgba(22,163,74,0.3)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold" style={{ fontSize: "17px", color: "var(--text-primary)" }}>Password updated</p>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginTop: 4 }}>Redirecting to your dashboard…</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="font-extrabold" style={{ fontSize: "22px", letterSpacing: "-0.035em", color: "var(--text-primary)", lineHeight: 1.2 }}>
              Choose a new password
            </h1>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.55 }}>
              Pick something strong — at least 8 characters.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <InputField
              label="New password"
              id="rp-password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="new-password"
              autoFocus
            />
            <InputField
              label="Confirm new password"
              id="rp-confirm"
              type="password"
              value={confirm}
              onChange={setConfirm}
              placeholder="••••••••"
              autoComplete="new-password"
            />

            {error && (
              <p className="rounded-[9px] px-3 py-2.5 text-[12.5px]"
                style={{ background: "rgba(220,38,38,0.07)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.15)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold rounded-[11px] flex items-center justify-center"
              style={{
                fontSize: "14.5px", padding: "13px 16px", marginTop: 4,
                background: loading ? "rgba(99,102,241,0.6)" : "linear-gradient(135deg, #6366F1 0%, #5254E8 100%)",
                color: "#fff",
                boxShadow: loading ? "none" : "0 4px 18px rgba(99,102,241,0.4), 0 1px 3px rgba(99,102,241,0.2)",
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "-0.01em",
              }}
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function InputField({
  label, id, type = "text", value, onChange, placeholder, autoComplete, autoFocus,
}: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  autoComplete?: string; autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}
        style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
      <input
        id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} autoFocus={autoFocus} required
        className="w-full rounded-[10px] border outline-none transition-all"
        style={{ fontSize: "14px", padding: "11px 14px", color: "var(--text-primary)", background: "rgba(255,255,255,0.9)", borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
      />
    </div>
  );
}
