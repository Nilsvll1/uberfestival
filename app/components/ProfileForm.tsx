"use client";

import { useRef, useState } from "react";
import { updateProfile, updateAvatarUrl } from "../actions/auth";
import { createClient } from "../../lib/supabase-browser";
import type { Profile } from "../../lib/types";
import { useI18n } from "../hooks/useI18n";

const GENRES = [
  "Electronic", "Techno", "Jazz", "Rock", "Metal", "Classical",
  "Folk", "Pop", "Hip-Hop", "Rap", "R&B", "Reggae",
  "World Music", "Multi-Genre", "Country", "Other",
];

const COUNTRIES = [
  "France", "United Kingdom", "Germany", "United States", "Canada",
  "Spain", "Italy", "Netherlands", "Belgium", "Switzerland",
  "Portugal", "Poland", "Sweden", "Norway", "Denmark", "Finland",
  "Austria", "Czech Republic", "Hungary", "Japan", "Australia",
  "Brazil", "Argentina", "Mexico", "South Africa", "Other",
];

function Field({
  label, id, type = "text", value, onChange, placeholder, hint, prefix,
}: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string; prefix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {prefix}
          </span>
        )}
        <input
          id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-search w-full rounded-[10px] border"
          style={{
            fontSize: "14px",
            padding: prefix ? "10px 14px 10px 80px" : "10px 14px",
            color: "var(--text-primary)", background: "rgba(255,255,255,0.8)",
            borderColor: "var(--border)", boxShadow: "var(--shadow-xs)",
          }}
        />
      </div>
      {hint && <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

function SelectField({
  label, id, value, onChange, options, emptyLabel,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  options: string[]; emptyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id} value={value} onChange={e => onChange(e.target.value)}
          className="w-full rounded-[10px] border appearance-none"
          style={{
            fontSize: "14px", padding: "10px 36px 10px 14px",
            color: value ? "var(--text-primary)" : "var(--text-muted)",
            background: "rgba(255,255,255,0.8)", borderColor: "var(--border)",
            boxShadow: "var(--shadow-xs)", cursor: "pointer",
          }}
        >
          <option value="">{emptyLabel}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          width="12" height="12" viewBox="0 0 12 8" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 1.5l5 5 5-5"/>
        </svg>
      </div>
    </div>
  );
}

export default function ProfileForm({
  profile,
  userId,
}: {
  profile: Partial<Profile>;
  userId: string;
}) {
  const { lang } = useI18n();
  const [artistName, setArtistName] = useState(profile.artist_name ?? "");
  const [country,    setCountry]    = useState(profile.country ?? "");
  const [genre,      setGenre]      = useState(profile.primary_genre ?? "");
  const [instagram,  setInstagram]  = useState(profile.instagram_url ?? "");
  const [spotify,    setSpotify]    = useState(profile.spotify_url ?? "");
  const [website,    setWebsite]    = useState(profile.website_url ?? "");
  const [loading,    setLoading]    = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(profile.avatar_url ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError,  setAvatarError]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(lang === "fr" ? "Max 2 Mo" : "Max 2 MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError(lang === "fr" ? "JPEG, PNG ou WebP uniquement" : "JPEG, PNG or WebP only");
      return;
    }
    setAvatarError(null);
    setAvatarLoading(true);

    try {
      const supabase = createClient();
      const path = `${userId}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

      // Cache-bust so the browser picks up the new image.
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      const result = await updateAvatarUrl(publicUrl);
      if (result.error) throw new Error(result.error);
      setAvatarUrl(bustedUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const result = await updateProfile({
      artist_name: artistName || null,
      country: country || null,
      primary_genre: genre || null,
      instagram_url: instagram || null,
      spotify_url: spotify || null,
      website_url: website || null,
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* ── Avatar ───────────────────────────────────────────────── */}
      <div
        className="rounded-[18px] border p-6 flex items-center gap-5 flex-wrap"
        style={{ background: "#fff", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
              style={{ border: "2px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-bold select-none"
              style={{
                fontSize: "22px",
                background: "linear-gradient(145deg, #818CF8 0%, #6366F1 55%, #5254E8 100%)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
              }}
            >
              {(artistName || profile.artist_name || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          {avatarLoading && (
            <div className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.45)" }}>
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-semibold" style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
            {lang === "fr" ? "Photo de profil" : "Profile photo"}
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {lang === "fr" ? "JPEG, PNG ou WebP · Max 2 Mo" : "JPEG, PNG or WebP · Max 2 MB"}
          </p>
          {avatarError && (
            <p style={{ fontSize: "12px", color: "#DC2626" }}>{avatarError}</p>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarLoading}
            className="btn-sm"
            style={{ alignSelf: "flex-start" }}
          >
            {avatarLoading
              ? (lang === "fr" ? "Téléchargement…" : "Uploading…")
              : (lang === "fr" ? "Changer la photo" : "Change photo")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
            aria-label={lang === "fr" ? "Choisir une photo" : "Choose photo"}
          />
        </div>
      </div>

      {/* ── Identity ─────────────────────────────────────────────── */}
      <div
        className="rounded-[18px] border p-6 flex flex-col gap-5"
        style={{ background: "#fff", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <p className="uppercase font-semibold tracking-[0.1em]"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {lang === "fr" ? "Identité artistique" : "Artist identity"}
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label={lang === "fr" ? "Nom d'artiste" : "Artist name"}
            id="profile-name"
            value={artistName}
            onChange={setArtistName}
            placeholder={lang === "fr" ? "Ton nom de scène" : "Your stage name"}
          />
          <SelectField
            label={lang === "fr" ? "Pays" : "Country"}
            id="profile-country"
            value={country}
            onChange={setCountry}
            options={COUNTRIES}
            emptyLabel={lang === "fr" ? "Sélectionner un pays" : "Select country"}
          />
        </div>
        <SelectField
          label={lang === "fr" ? "Genre principal" : "Primary genre"}
          id="profile-genre"
          value={genre}
          onChange={setGenre}
          options={GENRES}
          emptyLabel={lang === "fr" ? "Sélectionner un genre" : "Select genre"}
        />
      </div>

      {/* ── Links ────────────────────────────────────────────────── */}
      <div
        className="rounded-[18px] border p-6 flex flex-col gap-5"
        style={{ background: "#fff", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <p className="uppercase font-semibold tracking-[0.1em]"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {lang === "fr" ? "Présence en ligne" : "Online presence"}
        </p>
        <Field
          label="Instagram" id="profile-instagram"
          value={instagram} onChange={setInstagram}
          placeholder="yourhandle" prefix="instagram.com/"
          hint={lang === "fr" ? "Sans le @" : "Without the @"}
        />
        <Field
          label="Spotify" id="profile-spotify"
          value={spotify} onChange={setSpotify}
          placeholder="artist/…" prefix="open.spotify.com/"
        />
        <Field
          label={lang === "fr" ? "Site web" : "Website"} id="profile-website"
          type="url" value={website} onChange={setWebsite}
          placeholder="https://yoursite.com"
        />
      </div>

      {error && (
        <p className="rounded-[9px] px-3 py-2.5 text-[12.5px]"
          style={{ background: "rgba(220,38,38,0.07)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.15)" }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="btn-cta font-semibold rounded-[11px] flex items-center gap-2"
          style={{ fontSize: "14px", padding: "11px 22px", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading
            ? (lang === "fr" ? "Enregistrement…" : "Saving…")
            : (lang === "fr" ? "Enregistrer" : "Save changes")}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 font-medium" style={{ fontSize: "13px", color: "#16A34A" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 7l3.5 3.5 6-7"/>
            </svg>
            {lang === "fr" ? "Enregistré" : "Saved"}
          </span>
        )}
      </div>
    </form>
  );
}
