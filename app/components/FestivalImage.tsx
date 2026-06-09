"use client";

import { useState } from "react";
import type { FestivalImageConfig } from "../../lib/festivalImage";

export default function FestivalImage({
  image,
  category,
  color,
}: {
  image: FestivalImageConfig;
  category: string | null | undefined;
  color: { bg: string; text: string } | null;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {/* Instant gradient placeholder — shows the right color family immediately */}
      <div className="absolute inset-0" style={{ background: image.gradient }} />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover card-img"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 500ms ease",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            to bottom,
            rgba(0,0,0,0.04) 0%,
            rgba(0,0,0,0.10) 50%,
            rgba(0,0,0,${image.overlayStrength * 0.9}) 100%
          )`,
        }}
      />

      {color && category && (
        <div className="absolute bottom-3 left-3 z-10">
          <span
            className="inline-flex items-center text-[10px] font-semibold px-2 py-[3px] rounded-full"
            style={{
              background: "rgba(255,255,255,0.92)",
              color: color.text,
              backdropFilter: "blur(8px)",
              letterSpacing: "0.04em",
            }}
          >
            {category}
          </span>
        </div>
      )}
    </>
  );
}
