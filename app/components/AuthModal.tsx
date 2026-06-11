"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../../lib/supabase-browser";
import { syncLocalSaves } from "../actions/auth";
import { useI18n } from "../hooks/useI18n";

type View = "sign_in" | "sign_up";

const STORAGE_KEY = "uberfestival_saved";

function readLocalSaves(): number[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/* ── Field ───────────────────────────────────────────────────── */
function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  autoFocus,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        className="w-full rounded-[10px] border outline-none transition-all"
        style={{
          fontSize: "14px",
          padding: "11px 14px",
          color: "var(--text-primary)",
          background: "rgba(255,255,255,0.9)",
          borderColor: "var(--border)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12), 0 1px 2px rgba(0,0,0,0.04)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
        }}
      />
    </div>
  );
}

/* ── Google button ───────────────────────────────────────────── */
function GoogleButton({
  loading,
  onClick,
  label,
}: {
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 rounded-[11px] border font-medium transition-all"
      style={{
        fontSize: "14px",
        padding: "11px 16px",
        background: "#fff",
        borderColor: "var(--border-strong)",
        color: "var(--text-primary)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        opacity: loading ? 0.6 : 1,
        cursor: loading ? "not-allowed" : "pointer",
        transition: "box-shadow 140ms ease, transform 140ms ease",
      }}
      onMouseOver={(e) => {
        if (!loading) {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.07)";
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
          fill="#EA4335"
        />
      </svg>
      {loading ? "Connecting…" : label}
    </button>
  );
}

/* ── Divider ─────────────────────────────────────────────────── */
function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 500 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

/* ── Main form ───────────────────────────────────────────────── */
function AuthForm({
  onSuccess,
  mode = "modal",
  initialView = "sign_in",
}: {
  onSuccess?: () => void;
  mode?: "modal" | "page";
  initialView?: View;
}) {
  const { lang } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [view, setView] = useState<View>(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isSignIn = view === "sign_in";

  const afterAuth = useCallback(async () => {
    const localIds = readLocalSaves();
    if (localIds.length > 0) {
      await syncLocalSaves(localIds);
      localStorage.removeItem(STORAGE_KEY);
    }
    router.refresh();
    onSuccess?.();
    router.push("/dashboard");
  }, [router, onSuccess]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignIn) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const isUnconfirmed = error.message.includes("not confirmed") || error.code === "email_not_confirmed";
        setError(
          isUnconfirmed
            ? (lang === "fr"
                ? "Confirme ton email avant de te connecter. Vérifie ta messagerie."
                : "Please confirm your email before signing in. Check your inbox.")
            : (lang === "fr"
                ? "Email ou mot de passe incorrect."
                : "Incorrect email or password.")
        );
      } else {
        await afterAuth();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { artist_name: name } },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess(
          lang === "fr"
            ? "Vérifie ta messagerie pour confirmer ton compte."
            : "Check your inbox to confirm your account."
        );
      }
    }

    setLoading(false);
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(145deg, #4ade80 0%, #16a34a 100%)",
            boxShadow: "0 4px 16px rgba(22,163,74,0.3)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <p className="font-semibold" style={{ fontSize: "16px", color: "var(--text-primary)" }}>
            {lang === "fr" ? "Vérifie ta messagerie" : "Check your inbox"}
          </p>
          <p className="mt-1" style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {success}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div
          className="inline-flex items-center justify-center rounded-[12px] mb-4"
          style={{
            width: 44,
            height: 44,
            background: "linear-gradient(145deg, #818CF8 0%, #6366F1 55%, #5254E8 100%)",
            boxShadow: "0 4px 18px rgba(99,102,241,0.35)",
          }}
        >
          <svg width="20" height="16" viewBox="0 0 13 10" fill="none" aria-hidden="true">
            <path d="M1 1.5H12"  stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M1 5H8.5"   stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M1 8.5H10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1
          id="auth-dialog-title"
          className="font-extrabold"
          style={{ fontSize: "22px", letterSpacing: "-0.035em", color: "var(--text-primary)", lineHeight: 1.2 }}
        >
          {isSignIn
            ? (lang === "fr" ? "Bon retour." : "Welcome back.")
            : (lang === "fr" ? "Rejoins UberFestival." : "Join UberFestival.")}
        </h1>
        <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.55 }}>
          {isSignIn
            ? (lang === "fr" ? "Ton tableau de bord t'attend." : "Your career dashboard is waiting.")
            : (lang === "fr" ? "Retrouve et sauvegarde tes opportunités." : "Discover and track festival opportunities.")}
        </p>
      </div>

      {/* Google */}
      <GoogleButton
        loading={googleLoading}
        onClick={handleGoogle}
        label={lang === "fr" ? "Continuer avec Google" : "Continue with Google"}
      />

      <div className="my-4">
        <Divider label={lang === "fr" ? "ou" : "or"} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {!isSignIn && (
          <Field
            label={lang === "fr" ? "Nom d'artiste" : "Artist name"}
            id="auth-name"
            value={name}
            onChange={setName}
            placeholder={lang === "fr" ? "Ton nom de scène" : "Your stage name"}
            autoComplete="name"
            autoFocus={!isSignIn}
          />
        )}
        <Field
          label="Email"
          id="auth-email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
          autoFocus={isSignIn}
        />
        <Field
          label={lang === "fr" ? "Mot de passe" : "Password"}
          id="auth-password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={isSignIn ? "••••••••" : lang === "fr" ? "8 caractères minimum" : "8+ characters"}
          autoComplete={isSignIn ? "current-password" : "new-password"}
          required
        />

        {error && (
          <p
            className="rounded-[9px] px-3 py-2.5 text-[12.5px]"
            style={{ background: "rgba(220,38,38,0.07)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.15)" }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full font-semibold rounded-[11px] flex items-center justify-center transition-all"
          style={{
            fontSize: "14.5px",
            padding: "13px 16px",
            marginTop: 4,
            background: loading
              ? "rgba(99,102,241,0.6)"
              : "linear-gradient(135deg, #6366F1 0%, #5254E8 100%)",
            color: "#fff",
            boxShadow: loading ? "none" : "0 4px 18px rgba(99,102,241,0.4), 0 1px 3px rgba(99,102,241,0.2)",
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
          }}
          onMouseOver={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 6px 24px rgba(99,102,241,0.5), 0 2px 6px rgba(99,102,241,0.25)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            }
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 18px rgba(99,102,241,0.4), 0 1px 3px rgba(99,102,241,0.2)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          }}
        >
          {loading
            ? (lang === "fr" ? "Chargement…" : "Loading…")
            : isSignIn
              ? (lang === "fr" ? "Se connecter" : "Sign in")
              : (lang === "fr" ? "Créer mon compte" : "Create account")}
        </button>
      </form>

      {/* Toggle */}
      <p className="mt-5 text-center" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
        {isSignIn
          ? (lang === "fr" ? "Pas encore de compte ?" : "No account yet?")
          : (lang === "fr" ? "Tu as déjà un compte ?" : "Already have an account?")}
        {" "}
        <button
          type="button"
          onClick={() => { setView(isSignIn ? "sign_up" : "sign_in"); setError(null); }}
          style={{ color: "var(--accent)", fontWeight: 600 }}
          className="hover:opacity-75 transition-opacity"
        >
          {isSignIn
            ? (lang === "fr" ? "Créer un compte" : "Sign up")
            : (lang === "fr" ? "Se connecter" : "Sign in")}
        </button>
      </p>
    </div>
  );
}

/* ── Modal wrapper ───────────────────────────────────────────── */
export default function AuthModal({
  isOpen,
  onClose,
  initialView = "sign_in",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialView?: View;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const panel = panelRef.current;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        /* Overlay — centering container + backdrop */
        <motion.div
          className="fixed inset-0 z-[900] flex items-center justify-center p-4 sm:p-6"
          style={{
            background: "rgba(8, 8, 18, 0.6)",
            backdropFilter: "blur(14px) saturate(180%)",
            WebkitBackdropFilter: "blur(14px) saturate(180%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
          aria-hidden="false"
        >
          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            className="relative w-full rounded-[22px] overflow-y-auto"
            style={{
              maxWidth: 420,
              maxHeight: "90vh",
              background: "rgba(252, 252, 253, 0.98)",
              backdropFilter: "blur(32px) saturate(200%)",
              WebkitBackdropFilter: "blur(32px) saturate(200%)",
              border: "1px solid rgba(255,255,255,0.9)",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.06), 0 40px 100px rgba(0,0,0,0.3), 0 12px 32px rgba(0,0,0,0.14)",
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "tween", duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-7 sm:p-8">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(0,0,0,0.06)",
                  color: "var(--text-muted)",
                  transition: "background 140ms ease",
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.10)"; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.06)"; }}
                aria-label="Close"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M1 1l9 9M10 1l-9 9" />
                </svg>
              </button>

              <AuthForm
                onSuccess={onClose}
                mode="modal"
                initialView={initialView}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Page mode export ────────────────────────────────────────── */
export function AuthPage({ initialView = "sign_in" }: { initialView?: View }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-16">
      <div
        className="w-full rounded-[22px] p-8 sm:p-10"
        style={{
          maxWidth: 420,
          background: "#fff",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <AuthForm mode="page" initialView={initialView} />
      </div>
    </div>
  );
}
