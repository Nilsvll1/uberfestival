"use client";

import dynamic from "next/dynamic";
import type { Festival } from "../../lib/types";

const FestivalMap = dynamic(() => import("./FestivalMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl bg-gray-100 animate-pulse" />
  ),
});

export default function FestivalMapWrapper({
  festivals,
  className = "h-[80vh]",
}: {
  festivals: Festival[];
  className?: string;
}) {
  return (
    <div className={`w-full rounded-2xl overflow-hidden ${className}`}>
      <FestivalMap festivals={festivals} />
    </div>
  );
}
