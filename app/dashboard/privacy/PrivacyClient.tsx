"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateNotificationPrefs,
  exportUserData,
  deleteAccount,
} from "../../actions/auth";
import type { Language } from "../../../lib/i18n";
import type { NotificationPrefs } from "../../../lib/types";

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  id,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40,
        height: 24,
        borderRadius: 12,
        flexShrink: 0,
        background: checked ? "var(--accent)" : "rgba(0,0,0,0.12)",
        position: "relative",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 200ms ease",
        opacity: disabled ? 0.5 : 1,
      }}
      aria-disabled={disabled}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
          transition: "left 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <p
        className="uppercase font-semibold tracking-[0.1em] mb-4"
        style={{ fontSize: "10px", color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <div
        className="rounded-[18px] border"
        style={{ background: "#fff", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  htmlFor,
  title,
  description,
  children,
  border = true,
}: {
  htmlFor?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-4 p-5"
      style={{ borderBottom: border ? "1px solid var(--border)" : "none" }}
    >
      <label htmlFor={htmlFor} className="flex-1 cursor-pointer min-w-0">
        <p className="font-semibold" style={{ fontSize: "14px", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          {title}
        </p>
        <p className="mt-0.5" style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {description}
        </p>
      </label>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PrivacyClient({
  lang,
  email,
  notificationPrefs,
}: {
  lang: Language;
  email: string;
  notificationPrefs: NotificationPrefs;
}) {
  const fr = lang === "fr";

  // ── Notification prefs state ──────────────────────────────────────────────
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    email_reopening_alerts: true,
    ...notificationPrefs,
  });
  const [prefsSaving, startPrefsSave] = useTransition();
  const [prefsSaved,  setPrefsSaved]  = useState(false);
  const [prefsError,  setPrefsError]  = useState<string | null>(null);

  function setPref<K extends keyof NotificationPrefs>(key: K, value: boolean) {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setPrefsSaved(false);
  }

  function savePrefs() {
    setPrefsError(null);
    startPrefsSave(async () => {
      const result = await updateNotificationPrefs(prefs);
      if (result.error) { setPrefsError(result.error); return; }
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    });
  }

  // ── Data export ───────────────────────────────────────────────────────────
  const [exporting,   setExporting]   = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    const result = await exportUserData();
    setExporting(false);
    if (result.error || !result.data) {
      setExportError(result.error ?? "Export failed");
      return;
    }
    const blob = new Blob([result.data], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `uberfestival-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Account deletion ──────────────────────────────────────────────────────
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteInput,    setDeleteInput]    = useState("");
  const [deleting,       startDelete]       = useTransition();
  const [deleteError,    setDeleteError]    = useState<string | null>(null);

  const canDelete = deleteInput.trim().toLowerCase() === email.toLowerCase();

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteAccount();
      if (result?.error) setDeleteError(result.error);
      // deleteAccount calls redirect("/") on success — no explicit handling needed
    });
  }

  return (
    <main className="max-w-[680px] mx-auto px-5 lg:px-8 py-10 lg:py-14">

      {/* Back */}
      <Link
        href="/dashboard/profile"
        className="inline-flex items-center gap-2 mb-8 transition-opacity hover:opacity-60"
        style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "none" }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11L5 7l4-4"/>
        </svg>
        {fr ? "Profil" : "Profile"}
      </Link>

      {/* Header */}
      <div className="mb-10">
        <p className="uppercase font-semibold tracking-[0.1em] mb-2"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {fr ? "Paramètres" : "Settings"}
        </p>
        <h1 className="font-extrabold"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
          {fr ? "Confidentialité et données" : "Privacy & data"}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: 6 }}>
          {fr
            ? "Contrôle tes notifications, télécharge tes données et gère ton compte."
            : "Control your notifications, download your data, and manage your account."}
        </p>
      </div>

      {/* ── Notifications ─────────────────────────────────────────── */}
      <Section label={fr ? "Notifications par e-mail" : "Email notifications"}>
        <Row
          htmlFor="notif-deadlines"
          title={fr ? "Rappels de deadline" : "Deadline reminders"}
          description={fr
            ? "Reçois un e-mail quand la deadline d'un festival sauvegardé approche."
            : "Get an email when a saved festival's deadline is approaching."}
        >
          <Toggle
            id="notif-deadlines"
            checked={prefs.email_deadlines}
            onChange={v => setPref("email_deadlines", v)}
            disabled={prefsSaving}
          />
        </Row>
        <Row
          htmlFor="notif-opportunities"
          title={fr ? "Digest hebdomadaire" : "Weekly digest"}
          description={fr
            ? "Un récap chaque lundi des nouvelles opportunités qui correspondent à ton genre et ton pays."
            : "A Monday recap of new festivals matching your genre and country preferences."}
        >
          <Toggle
            id="notif-opportunities"
            checked={prefs.email_new_opportunities}
            onChange={v => setPref("email_new_opportunities", v)}
            disabled={prefsSaving}
          />
        </Row>
        <Row
          htmlFor="notif-reopening"
          title={fr ? "Alertes de réouverture" : "Reopening alerts"}
          description={fr
            ? "Sois averti dès qu'un festival que tu as sauvegardé rouvre ses candidatures."
            : "Get notified when a festival you've saved reopens for applications."}
        >
          <Toggle
            id="notif-reopening"
            checked={prefs.email_reopening_alerts ?? true}
            onChange={v => setPref("email_reopening_alerts", v)}
            disabled={prefsSaving}
          />
        </Row>
        <Row
          htmlFor="notif-updates"
          title={fr ? "Mises à jour produit" : "Product updates"}
          description={fr
            ? "Nouvelles fonctionnalités et améliorations d'UberFestival."
            : "New features and improvements to UberFestival."}
          border={false}
        >
          <Toggle
            id="notif-updates"
            checked={prefs.email_product_updates}
            onChange={v => setPref("email_product_updates", v)}
            disabled={prefsSaving}
          />
        </Row>

        <div className="px-5 pb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={savePrefs}
            disabled={prefsSaving}
            className="btn-cta font-semibold rounded-[10px]"
            style={{ fontSize: "13px", padding: "9px 18px", opacity: prefsSaving ? 0.7 : 1, cursor: prefsSaving ? "not-allowed" : "pointer" }}
          >
            {prefsSaving
              ? (fr ? "Enregistrement…" : "Saving…")
              : (fr ? "Enregistrer" : "Save preferences")}
          </button>
          {prefsSaved && (
            <span className="flex items-center gap-1.5" style={{ fontSize: "13px", color: "#16A34A", fontWeight: 500 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 7l3.5 3.5 6-7"/>
              </svg>
              {fr ? "Enregistré" : "Saved"}
            </span>
          )}
          {prefsError && (
            <span style={{ fontSize: "12.5px", color: "#DC2626" }}>{prefsError}</span>
          )}
        </div>
      </Section>

      {/* ── Your data ─────────────────────────────────────────────── */}
      <Section label={fr ? "Tes données" : "Your data"}>
        <div className="p-5">
          <p className="font-semibold mb-1" style={{ fontSize: "14px", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            {fr ? "Exporter toutes mes données" : "Export all my data"}
          </p>
          <p className="mb-4" style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {fr
              ? "Télécharge un fichier JSON contenant ton profil, tes festivals sauvegardés et ton historique de navigation."
              : "Download a JSON file containing your profile, saved festivals, and browsing history."}
          </p>
          {exportError && (
            <p className="mb-3 rounded-[9px] px-3 py-2 text-[12.5px]"
              style={{ background: "rgba(220,38,38,0.07)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.15)" }}>
              {exportError}
            </p>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="btn-sm flex items-center gap-2"
            style={{ opacity: exporting ? 0.6 : 1, cursor: exporting ? "not-allowed" : "pointer" }}
          >
            {exporting ? (
              <>
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                </svg>
                {fr ? "Export en cours…" : "Exporting…"}
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10"/>
                </svg>
                {fr ? "Télécharger mes données" : "Download my data"}
              </>
            )}
          </button>
        </div>
      </Section>

      {/* ── Danger zone ───────────────────────────────────────────── */}
      <section>
        <p className="uppercase font-semibold tracking-[0.1em] mb-4"
          style={{ fontSize: "10px", color: "#DC2626" }}>
          {fr ? "Zone dangereuse" : "Danger zone"}
        </p>
        <div
          className="rounded-[18px] border p-5"
          style={{ background: "#fff", borderColor: "rgba(220,38,38,0.2)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="font-semibold mb-1"
            style={{ fontSize: "14px", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            {fr ? "Supprimer mon compte" : "Delete account"}
          </p>
          <p className="mb-4" style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {fr
              ? "La suppression est définitive et irréversible. Tous tes festivals sauvegardés et ton profil seront effacés."
              : "This is permanent and irreversible. All your saved festivals, profile, and data will be deleted immediately."}
          </p>

          {!showDeleteZone ? (
            <button
              type="button"
              onClick={() => setShowDeleteZone(true)}
              className="btn-sm"
              style={{ color: "#DC2626", borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.04)" }}
            >
              {fr ? "Supprimer mon compte" : "Delete my account"}
            </button>
          ) : (
            <div
              className="rounded-[12px] border p-4 flex flex-col gap-3"
              style={{ background: "rgba(220,38,38,0.04)", borderColor: "rgba(220,38,38,0.20)" }}
            >
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {fr
                  ? <>Pour confirmer, saisis ton adresse e-mail : <strong>{email}</strong></>
                  : <>To confirm, type your email address: <strong>{email}</strong></>}
              </p>
              <input
                type="email"
                value={deleteInput}
                onChange={e => { setDeleteInput(e.target.value); setDeleteError(null); }}
                placeholder={email}
                autoComplete="off"
                aria-label={fr ? "Confirme ton adresse e-mail" : "Confirm your email address"}
                className="w-full rounded-[10px] border outline-none"
                style={{
                  fontSize: "14px", padding: "10px 14px",
                  color: "var(--text-primary)", background: "#fff",
                  borderColor: deleteInput && !canDelete ? "rgba(220,38,38,0.4)" : "var(--border)",
                  boxShadow: "var(--shadow-xs)", transition: "border-color 120ms ease",
                }}
                onFocus={e => { e.currentTarget.style.boxShadow = "0 0 0 3px rgba(220,38,38,0.10)"; }}
                onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-xs)"; }}
              />

              {deleteError && (
                <p className="rounded-[9px] px-3 py-2 text-[12.5px]"
                  style={{ background: "rgba(220,38,38,0.07)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.15)" }}>
                  {deleteError}
                </p>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canDelete || deleting}
                  className="font-semibold rounded-[10px] transition-opacity"
                  style={{
                    fontSize: "13px", padding: "9px 18px",
                    background: canDelete && !deleting ? "#DC2626" : "rgba(220,38,38,0.35)",
                    color: "#fff", border: "none",
                    cursor: !canDelete || deleting ? "not-allowed" : "pointer",
                    boxShadow: canDelete && !deleting ? "0 4px 16px rgba(220,38,38,0.30)" : "none",
                  }}
                >
                  {deleting
                    ? (fr ? "Suppression…" : "Deleting…")
                    : (fr ? "Supprimer définitivement" : "Permanently delete")}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteZone(false); setDeleteInput(""); setDeleteError(null); }}
                  className="btn-ghost"
                  style={{ fontSize: "13px" }}
                >
                  {fr ? "Annuler" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
