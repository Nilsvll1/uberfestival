"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
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

function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 32 : count < 100 ? 38 : 44;
  const half = size / 2;
  const fontSize = count < 10 ? 13 : count < 100 ? 12 : 11;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:#6366F1;
      border:2.5px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.22),0 0 0 4px rgba(99,102,241,0.18);
      display:flex;align-items:center;justify-content:center;
      color:#fff;
      font-size:${fontSize}px;
      font-weight:700;
      font-family:system-ui,-apple-system,sans-serif;
      letter-spacing:-0.02em;
      cursor:pointer;
    ">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

// Memoized per-festival marker. Re-renders only when isActive changes for
// this specific festival — not on every hoveredId change in the parent.
const MemoMarker = memo(function MemoMarker({
  festival,
  isActive,
  onHoverChange,
}: {
  festival: Festival;
  isActive: boolean;
  onHoverChange: (id: number | null) => void;
}) {
  const router = useRouter();
  const color  = festival.category ? genreColor(festival.category) : null;
  const accent = color?.text ?? "#6366F1";

  const icon = useMemo(
    () => createMarkerIcon(accent, isActive),
    [accent, isActive]
  );

  const handlers = useMemo(() => ({
    click:     () => router.push(`/festival/${festival.id}`),
    mouseover: () => onHoverChange(festival.id),
    mouseout:  () => onHoverChange(null),
  // router is stable; festival.id and onHoverChange don't change per render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [festival.id, onHoverChange]);

  return (
    <Marker
      position={[festival.latitude!, festival.longitude!]}
      icon={icon}
      eventHandlers={handlers}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={1} className="festival-tooltip">
        <span className="festival-tooltip-name">{festival.festival_name}</span>
        {(festival.city || festival.country) && (
          <span className="festival-tooltip-location">
            {[festival.city, festival.country].filter(Boolean).join(", ")}
          </span>
        )}
      </Tooltip>
    </Marker>
  );
});

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
  // Defer marker rendering until MarkerClusterGroup is mounted on the map.
  // React fires child useEffects before parent useEffects, so without this
  // all 1,000+ marker effects would run while this._map is null, making every
  // addLayer synchronous and blocking the main thread.
  const [clusterReady, setClusterReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setClusterReady(true), 0);
    return () => clearTimeout(id);
  }, []);

  const handleHoverChange = useCallback(
    (id: number | null) => onHoverChange?.(id),
    [onHoverChange]
  );

  const validFestivals = useMemo(
    () => festivals.filter((f) => f.latitude && f.longitude),
    [festivals]
  );

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

      <MapController festivals={validFestivals} hoveredId={hoveredId} />

      <MarkerClusterGroup
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={60}
        showCoverageOnHover={false}
        animate
        chunkedLoading
      >
        {clusterReady && validFestivals.map((festival) => (
          <MemoMarker
            key={festival.id}
            festival={festival}
            isActive={hoveredId === festival.id}
            onHoverChange={handleHoverChange}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
