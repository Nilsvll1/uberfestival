"use client";

import { isApplyNowStatus } from "../../lib/utils";
import type { ApplicationStatus } from "../../lib/utils";

// Re-export from lib/utils so client-side importers (FestivalCard) don't need to change.
export { isApplyNowStatus } from "../../lib/utils";
export type { ApplicationStatus } from "../../lib/utils";

type BadgeSize = "sm" | "md";

export function ApplicationStatusBadge({
  status,
  size = "sm",
}: {
  status: ApplicationStatus | string | null | undefined;
  size?: BadgeSize;
}) {
  if (!status || status === "unknown") return null;

  const s = status as ApplicationStatus;
  const isApply   = isApplyNowStatus(s);
  const isContact = s === "contact_submission";
  const isInvite  = s === "invitation_only";
  const isClosed  = s === "seasonally_closed";

  if (!isApply && !isContact && !isInvite && !isClosed) return null;

  const pad = size === "md" ? "4px 10px" : "2px 7px";
  const fontSize = size === "md" ? "12px" : "10.5px";

  if (isApply) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: pad,
          fontSize,
          fontWeight: 700,
          letterSpacing: "0.01em",
          lineHeight: 1.4,
          borderRadius: 7,
          background: "rgba(22,163,74,0.10)",
          color: "#15803D",
          border: "1px solid rgba(22,163,74,0.22)",
        }}
      >
        <span style={{ fontSize: size === "md" ? 8 : 7 }}>●</span>
        Apply Now
      </span>
    );
  }

  if (isContact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: pad,
          fontSize,
          fontWeight: 600,
          letterSpacing: "0.01em",
          lineHeight: 1.4,
          borderRadius: 7,
          background: "rgba(99,102,241,0.08)",
          color: "#6366F1",
          border: "1px solid rgba(99,102,241,0.20)",
        }}
      >
        Contact to Inquire
      </span>
    );
  }

  if (isInvite) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: pad,
          fontSize,
          fontWeight: 600,
          letterSpacing: "0.01em",
          lineHeight: 1.4,
          borderRadius: 7,
          background: "rgba(0,0,0,0.05)",
          color: "var(--text-muted)",
          border: "1px solid rgba(0,0,0,0.09)",
        }}
      >
        Invite Only
      </span>
    );
  }

  // seasonally_closed
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: pad,
        fontSize,
        fontWeight: 600,
        letterSpacing: "0.01em",
        lineHeight: 1.4,
        borderRadius: 7,
        background: "rgba(202,138,4,0.10)",
        color: "#A16207",
        border: "1px solid rgba(202,138,4,0.22)",
      }}
    >
      Closed for Now
    </span>
  );
}
