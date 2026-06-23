"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Festival } from "../../lib/types";
import { genreColor } from "../../lib/utils";

delete (L.Icon.Default.prototype as any)._getIconUrl;

// Icon never changes after mount — active state is toggled via CSS class directly
// on the marker element, bypassing React and Leaflet's setIcon() entirely.
function createMarkerIcon(accentColor: string) {
  return L.divIcon({
    html: `<div class="ubf-marker-dot" style="background:${accentColor}"></div>`,
    className: "ubf-marker",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

// Fully static after mount: no isActive prop, no useRouter.
// Re-renders only when festival identity or stable callbacks change (never in practice).
const MemoMarker = memo(function MemoMarker({
  festival,
  onHoverChange,
  onClick,
  onRegisterRef,
}: {
  festival: Festival;
  onHoverChange: (id: number | null) => void;
  onClick: (id: number) => void;
  onRegisterRef: (id: number, marker: L.Marker | null) => void;
}) {
  const color = festival.category ? genreColor(festival.category) : null;
  const accent = color?.text ?? "#6366F1";

  const icon = useMemo(() => createMarkerIcon(accent), [accent]);

  const handlers = useMemo(
    () => ({
      click: () => onClick(festival.id),
      mouseover: () => onHoverChange(festival.id),
      mouseout: () => onHoverChange(null),
    }),
    [festival.id, onClick, onHoverChange]
  );

  const refCallback = useCallback(
    (marker: L.Marker | null) => onRegisterRef(festival.id, marker),
    [festival.id, onRegisterRef]
  );

  return (
    <Marker
      ref={refCallback}
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

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
};

function MapController({
  festivals,
  hoveredId,
  onBoundsChange,
}: {
  festivals: Festival[];
  hoveredId: number | null;
  onBoundsChange?: (bounds: MapBounds) => void;
}) {
  const map = useMap();

  // O(1) lookup instead of O(n) find on every hover change.
  const festivalById = useMemo(
    () => new Map(festivals.map((f) => [f.id, f])),
    [festivals]
  );

  useEffect(() => {
    if (hoveredId === null) return;
    const festival = festivalById.get(hoveredId);
    if (!festival?.latitude || !festival?.longitude) return;
    const latlng = L.latLng(festival.latitude, festival.longitude);
    if (!map.getBounds().contains(latlng)) {
      map.panTo(latlng, { animate: true, duration: 0.5, easeLinearity: 0.5 });
    }
  }, [hoveredId, festivalById, map]);

  useEffect(() => {
    if (!onBoundsChange) return;
    const emit = () => {
      const b = map.getBounds();
      onBoundsChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
        zoom: map.getZoom(),
      });
    };
    emit();
    map.on("moveend", emit);
    map.on("zoomend", emit);
    return () => {
      map.off("moveend", emit);
      map.off("zoomend", emit);
    };
  }, [map, onBoundsChange]);

  return null;
}

export default function FestivalMap({
  festivals,
  center = [20, 0],
  zoom = 2,
  scrollWheelZoom = true,
  hoveredId = null,
  onHoverChange,
  onBoundsChange,
}: {
  festivals: Festival[];
  center?: [number, number];
  zoom?: number;
  scrollWheelZoom?: boolean;
  hoveredId?: number | null;
  onHoverChange?: (id: number | null) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
}) {
  // Single router instance for the whole map (not per-marker).
  const router = useRouter();

  // Direct refs to Leaflet marker instances for zero-React-render hover toggling.
  const markerRefsMap = useRef(new Map<number, L.Marker>());
  const prevHoveredRef = useRef<number | null>(null);

  const [clusterReady, setClusterReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setClusterReady(true), 0);
    return () => clearTimeout(id);
  }, []);

  // Apply active CSS class directly on the Leaflet marker DOM element.
  // No React re-renders happen for hover state changes.
  useEffect(() => {
    const prev = prevHoveredRef.current;
    if (prev !== null) {
      markerRefsMap.current.get(prev)?.getElement()?.classList.remove("ubf-marker-active");
    }
    if (hoveredId !== null) {
      markerRefsMap.current.get(hoveredId)?.getElement()?.classList.add("ubf-marker-active");
    }
    prevHoveredRef.current = hoveredId;
  }, [hoveredId]);

  const handleHoverChange = useCallback(
    (id: number | null) => onHoverChange?.(id),
    [onHoverChange]
  );

  const handleClick = useCallback(
    (id: number) => router.push(`/festival/${id}`),
    [router]
  );

  const registerMarkerRef = useCallback(
    (id: number, marker: L.Marker | null) => {
      if (marker) {
        markerRefsMap.current.set(id, marker);
      } else {
        markerRefsMap.current.delete(id);
      }
    },
    []
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
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      <MapController
        festivals={validFestivals}
        hoveredId={hoveredId}
        onBoundsChange={onBoundsChange}
      />

      <MarkerClusterGroup
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={60}
        showCoverageOnHover={false}
        animate
        chunkedLoading
        disableClusteringAtZoom={9}
        animateAddingMarkers={false}
      >
        {clusterReady &&
          validFestivals.map((festival) => (
            <MemoMarker
              key={festival.id}
              festival={festival}
              onHoverChange={handleHoverChange}
              onClick={handleClick}
              onRegisterRef={registerMarkerRef}
            />
          ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
