"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { FestivalImageConfig } from "../../lib/festivalImage";

export default function FestivalImage({
  image,
  category,
  color,
  layoutId,
}: {
  image: FestivalImageConfig;
  category: string | null | undefined;
  color: { bg: string; text: string } | null;
  layoutId?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {/* Instant gradient placeholder — correct color family, zero network wait */}
      <div className="absolute inset-0" style={{ background: image.gradient }} />

      {/* Photo: fades + scales in when loaded; participates in shared hero transition */}
      <motion.img
        layoutId={layoutId}
        src={image.url}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        animate={{
          opacity: loaded ? 1 : 0,
          scale: loaded ? 1 : 1.05,
        }}
        transition={{
          opacity: { duration: 0.55, ease: "easeOut" },
          scale: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
          layout: { type: "spring", stiffness: 200, damping: 26, restDelta: 0.001 },
        }}
      />

      {/* Subtle vignette overlay */}
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

      {/* Genre badge */}
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
