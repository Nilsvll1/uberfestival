"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Festival } from "../../lib/types";
import { formatDeadline, genreColor } from "../../lib/utils";

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

export default function FestivalMap({ festivals }: { festivals: Festival[] }) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {festivals.map((festival) => {
        if (!festival.latitude || !festival.longitude) return null;

        const deadline = formatDeadline(festival.submission_deadline);
        const color = festival.category ? genreColor(festival.category) : null;

        return (
          <Marker
            key={festival.id}
            position={[festival.latitude, festival.longitude]}
          >
            <Popup>
              <div style={{ minWidth: "200px", fontFamily: "system-ui, sans-serif" }}>
                {color && festival.category && (
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: color.bg,
                      color: color.text,
                      marginBottom: "8px",
                    }}
                  >
                    {festival.category}
                  </span>
                )}
                <p style={{ fontWeight: 600, fontSize: "14px", margin: "0 0 2px" }}>
                  {festival.festival_name}
                </p>
                <p style={{ fontSize: "12px", color: "#6B7280", margin: "0 0 8px" }}>
                  {[festival.city, festival.country].filter(Boolean).join(", ")}
                </p>
                {deadline && (
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color:
                        deadline.status === "urgent"
                          ? "#DC2626"
                          : deadline.status === "soon"
                          ? "#D97706"
                          : deadline.status === "expired"
                          ? "#A3A3A3"
                          : "#059669",
                      margin: "0 0 8px",
                    }}
                  >
                    {deadline.label}
                  </p>
                )}
                {festival.application_url && (
                  <a
                    href={festival.application_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#fff",
                      background: "#6366F1",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      textDecoration: "none",
                    }}
                  >
                    Postuler →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
