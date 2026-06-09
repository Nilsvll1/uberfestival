"use client";

import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { Festival } from "../../lib/types";
import { genreColor } from "../../lib/utils";

// Suppress Leaflet's default icon URL resolution (not needed with divIcon)
delete (L.Icon.Default.prototype as any)._getIconUrl;

function createMarkerIcon(accentColor: string, isHovered = false) {
  const size = isHovered ? 20 : 16;
  const offset = size / 2;
  return L.divIcon({
    html: `<div class="festival-pin" style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${accentColor};
      border: 2.5px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.24), 0 0 0 0.5px rgba(0,0,0,0.08);
      cursor: pointer;
    "></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [offset, offset],
  });
}

export default function FestivalMap({
  festivals,
  center = [20, 0],
  zoom = 2,
  scrollWheelZoom = true,
}: {
  festivals: Festival[];
  center?: [number, number];
  zoom?: number;
  scrollWheelZoom?: boolean;
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

      {festivals.map((festival) => {
        if (!festival.latitude || !festival.longitude) return null;

        const color = festival.category ? genreColor(festival.category) : null;
        const accentColor = color?.text ?? "#6366F1";
        const icon = createMarkerIcon(accentColor);

        return (
          <Marker
            key={festival.id}
            position={[festival.latitude, festival.longitude]}
            icon={icon}
            eventHandlers={{
              click: () => router.push(`/festival/${festival.id}`),
              mouseover: (e) => {
                e.target.setIcon(createMarkerIcon(accentColor, true));
              },
              mouseout: (e) => {
                e.target.setIcon(createMarkerIcon(accentColor, false));
              },
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              opacity={1}
              className="festival-tooltip"
            >
              <span className="festival-tooltip-name">
                {festival.festival_name}
              </span>
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
