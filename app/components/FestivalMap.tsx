"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { Festival } from "../../lib/types";
import { genreColor } from "../../lib/utils";

delete (L.Icon.Default.prototype as any)._getIconUrl;

function createMarkerIcon(accentColor: string, active: boolean) {
  const size = active ? 22 : 16;
  const offset = size / 2;
  const shadow = active
    ? `0 0 0 5px ${accentColor}28, 0 2px 8px rgba(0,0,0,0.22)`
    : `0 2px 8px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.08)`;
  const animClass = active ? "marker-pulse" : "";
  return L.divIcon({
    html: `<div class="${animClass}" style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${accentColor};
      border:2.5px solid #fff;
      box-shadow:${shadow};
      transition:width 200ms cubic-bezier(0.22,1,0.36,1),height 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease;
      cursor:pointer;
    "></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [offset, offset],
  });
}

function MapController({ festivals, hoveredId }: { festivals: Festival[]; hoveredId: number | null }) {
  const map = useMap();

  useEffect(() => {
    if (hoveredId === null) return;
    const festival = festivals.find((f) => f.id === hoveredId);
    if (!festival?.latitude || !festival?.longitude) return;

    const latlng = L.latLng(festival.latitude, festival.longitude);
    if (!map.getBounds().contains(latlng)) {
      map.panTo(latlng, { animate: true, duration: 0.5, easeLinearity: 0.5 });
    }
  }, [hoveredId, festivals, map]);

  return null;
}

export default function FestivalMap({
  festivals,
  center = [20, 0],
  zoom = 2,
  scrollWheelZoom = true,
  hoveredId = null,
  onHoverChange,
}: {
  festivals: Festival[];
  center?: [number, number];
  zoom?: number;
  scrollWheelZoom?: boolean;
  hoveredId?: number | null;
  onHoverChange?: (id: number | null) => void;
}) {
  const router = useRouter();

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      style={{ height: "100%", width: "100%" }}
      zoomAnimation
      fadeAnimation
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      <MapController festivals={festivals} hoveredId={hoveredId} />

      {festivals.map((festival) => {
        if (!festival.latitude || !festival.longitude) return null;

        const color      = festival.category ? genreColor(festival.category) : null;
        const accent     = color?.text ?? "#6366F1";
        const isActive   = hoveredId === festival.id;
        const icon       = createMarkerIcon(accent, isActive);

        return (
          <Marker
            key={festival.id}
            position={[festival.latitude, festival.longitude]}
            icon={icon}
            eventHandlers={{
              click:     () => router.push(`/festival/${festival.id}`),
              mouseover: () => onHoverChange?.(festival.id),
              mouseout:  () => onHoverChange?.(null),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              opacity={1}
              className="festival-tooltip"
            >
              <span className="festival-tooltip-name">{festival.festival_name}</span>
              {(festival.city || festival.country) && (
                <span className="festival-tooltip-location">
                  {[festival.city, festival.country].filter(Boolean).join(", ")}
                </span>
              )}
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
