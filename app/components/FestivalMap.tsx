"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Festival = {
  id: number;
  festival_name: string;
  city: string;
  country: string;
  category: string;
  application_url: string;
  submission_deadline: string;
  latitude: number;
  longitude: number;
};

export default function FestivalMap({
  festivals,
}: {
  festivals: Festival[];
}) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      scrollWheelZoom={true}
      style={{
        height: "80vh",
        width: "100%",
        borderRadius: "12px",
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {festivals.map((festival) => {
        if (!festival.latitude || !festival.longitude) {
          return null;
        }

        return (
          <Marker
            key={festival.id}
            position={[
              festival.latitude,
              festival.longitude,
            ]}
          >
            <Popup>
              <div style={{ minWidth: "220px" }}>
                <h3>
                  <strong>
                    {festival.festival_name}
                  </strong>
                </h3>

                <p>
                  {festival.city}
                  <br />
                  {festival.country}
                </p>

                <p>
                  Genre : {festival.category}
                </p>

                <p>
                  Deadline :
                  <br />
                  {festival.submission_deadline}
                </p>

                <a
                  href={festival.application_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🎵 Postuler
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}