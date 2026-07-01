"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { signOut } from "../actions/auth";
import AuthModal from "./AuthModal";
import { useI18n } from "../hooks/useI18n";

export default function UserMenu({ user, avatarUrl = null }: { user: User | null; avatarUrl?: string | null }) {
  const { lang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-nav-submit"
          style={{ fontWeight: 500 }}
        >
          {lang === "fr" ? "Se connecter" : "Sign in"}
        </button>
        <AuthModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialView="sign_in"
        />
      </>
    );
  }

  // Logged in — show avatar + dropdown
  const initials = user.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
        aria-label="User menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            aria-hidden="true"
            className="w-7 h-7 rounded-full object-cover"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
          />
        ) : (
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center font-semibold select-none"
          style={{
            fontSize: "11px",
            background: "linear-gradient(145deg, #818CF8 0%, #6366F1 55%, #5254E8 100%)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
          }}
        >
          {initials}
        </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 6"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{
            transition: "transform 160ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 mt-2 dropdown-content"
            style={{
              width: 200,
              background: "rgba(250,250,251,0.98)",
              backdropFilter: "blur(32px) saturate(200%)",
              WebkitBackdropFilter: "blur(32px) saturate(200%)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
              zIndex: 600,
              overflow: "hidden",
              padding: "6px",
            }}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.6 }}
          >
            {/* User info */}
            <div
              className="px-3 py-2.5 mb-1"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p
                className="font-medium truncate"
                style={{ fontSize: "12.5px", color: "var(--text-primary)" }}
              >
                {user.email}
              </p>
            </div>

            {/* Menu items */}
            <MenuItem
              href="/dashboard"
              icon={
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="1" width="5" height="5" rx="1.5"/>
                  <rect x="8" y="1" width="5" height="5" rx="1.5"/>
                  <rect x="1" y="8" width="5" height="5" rx="1.5"/>
                  <rect x="8" y="8" width="5" height="5" rx="1.5"/>
                </svg>
              }
              label={lang === "fr" ? "Tableau de bord" : "Dashboard"}
              onClick={() => setOpen(false)}
            />
            <MenuItem
              href="/dashboard/opportunities"
              icon={
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7" cy="7" r="5.5"/>
                  <path d="M5 7l1.5 1.5L9.5 5"/>
                </svg>
              }
              label={lang === "fr" ? "Opportunités" : "Opportunities"}
              onClick={() => setOpen(false)}
            />
            <MenuItem
              href="/dashboard/profile"
              icon={
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7" cy="5" r="2.5"/>
                  <path d="M2 12c0-2.21 2.239-4 5-4s5 1.79 5 4"/>
                </svg>
              }
              label={lang === "fr" ? "Profil" : "Profile"}
              onClick={() => setOpen(false)}
            />
            <MenuItem
              href="/dashboard/collections"
              icon={
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="1" width="5.5" height="5.5" rx="1.5"/>
                  <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.5"/>
                  <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.5"/>
                  <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.5"/>
                </svg>
              }
              label={lang === "fr" ? "Collections" : "Collections"}
              onClick={() => setOpen(false)}
            />
            <MenuItem
              href="/dashboard/privacy"
              icon={
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 1.5L2 4v3.5C2 10.5 4.2 12.9 7 13.5c2.8-.6 5-3 5-6V4L7 1.5z"/>
                </svg>
              }
              label={lang === "fr" ? "Confidentialité" : "Privacy & data"}
              onClick={() => setOpen(false)}
            />

            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />

            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.refresh();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-left transition-colors"
              style={{ fontSize: "13px", color: "#DC2626" }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.06)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9"/>
                <path d="M6 10l-3-3 3-3"/>
                <path d="M3 7h8"/>
              </svg>
              {lang === "fr" ? "Se déconnecter" : "Sign out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] transition-colors"
      style={{ fontSize: "13px", color: "var(--text-primary)", textDecoration: "none" }}
      onMouseOver={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.04)"; }}
      onMouseOut={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
    >
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      {label}
    </Link>
  );
}
