"use client";

import dynamic from "next/dynamic";
import type { Festival } from "../../lib/types";

const FestivalMap = dynamic(() => import("./FestivalMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#e8edf2] animate-pulse" />
  ),
});

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
