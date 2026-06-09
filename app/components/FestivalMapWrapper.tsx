"use client";

import dynamic from "next/dynamic";
import type { Festival } from "../../lib/types";

const FestivalMap = dynamic(() => import("./FestivalMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return (
    <div className="h-full w-full relative overflow-hidden" style={{ background: "#e8edf2" }}>
      {/* Shimmer sweep */}
      <div className="map-skeleton-shimmer" />
      {/* Fake dot cluster — center of map */}
      <div style={{ position: "absolute", inset: 0 }}>
        {[
          [38, 52], [42, 56], [35, 48], [45, 44],
          [52, 58], [30, 62], [48, 38], [60, 50],
        ].map(([top, left], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${top}%`,
              left: `${left}%`,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "rgba(99,102,241,0.18)",
              border: "2px solid rgba(255,255,255,0.7)",
              transform: "translate(-50%,-50%)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function FestivalMapWrapper({
  festivals,
  className = "h-[80vh]",
  center,
  zoom,
  scrollWheelZoom,
}: {
  festivals: Festival[];
  className?: string;
  center?: [number, number];
  zoom?: number;
  scrollWheelZoom?: boolean;
}) {
  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <FestivalMap
        festivals={festivals}
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
      />
    </div>
  );
}
