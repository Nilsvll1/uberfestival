export default function FestivalLoading() {
  return (
    <main>
      {/* Hero skeleton */}
      <div
        style={{
          height: "62vh",
          minHeight: 420,
          maxHeight: 720,
          background: "linear-gradient(160deg, #d1d5db 0%, #e5e7eb 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="map-skeleton-shimmer" />
        {/* Back button stub */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            width: 90,
            height: 32,
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
          }}
        />
        {/* Name stub */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 20,
            right: 20,
            maxWidth: 900,
          }}
        >
          <div style={{ width: 80, height: 10, borderRadius: 99, background: "rgba(255,255,255,0.3)", marginBottom: 16 }} />
          <div style={{ width: "70%", height: 48, borderRadius: 10, background: "rgba(255,255,255,0.22)", marginBottom: 8 }} />
          <div style={{ width: "45%", height: 48, borderRadius: 10, background: "rgba(255,255,255,0.16)", marginBottom: 24 }} />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 160, height: 46, borderRadius: 12, background: "rgba(255,255,255,0.30)" }} />
            <div style={{ width: 100, height: 20, borderRadius: 6, background: "rgba(255,255,255,0.18)", alignSelf: "center" }} />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-[900px] mx-auto px-5 lg:px-8 py-10 lg:py-14">
        {/* Atmosphere */}
        <div className="mb-12">
          <div style={{ width: 80, height: 8, borderRadius: 4, background: "rgba(0,0,0,0.06)", marginBottom: 16 }} />
          <div style={{ width: "75%", height: 28, borderRadius: 6, background: "rgba(0,0,0,0.07)", marginBottom: 8 }} />
          <div style={{ width: "55%", height: 28, borderRadius: 6, background: "rgba(0,0,0,0.05)", marginBottom: 16 }} />
          <div style={{ width: "80%", height: 14, borderRadius: 4, background: "rgba(0,0,0,0.05)", marginBottom: 6 }} />
          <div style={{ width: "65%", height: 14, borderRadius: 4, background: "rgba(0,0,0,0.04)" }} />
        </div>

        {/* Info + map grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Info card */}
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.07)",
              background: "#fff",
              padding: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}
          >
            <div style={{ width: 60, height: 8, borderRadius: 4, background: "rgba(0,0,0,0.06)", marginBottom: 20 }} />
            {[80, 60, 70].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: "rgba(0,0,0,0.06)" }} />
                <div style={{ width: 72, height: 10, borderRadius: 4, background: "rgba(0,0,0,0.05)" }} />
                <div style={{ width: `${w}px`, height: 10, borderRadius: 4, background: "rgba(0,0,0,0.07)" }} />
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "16px 0" }} />
            <div style={{ height: 44, borderRadius: 11, background: "rgba(99,102,241,0.10)" }} />
          </div>

          {/* Map placeholder */}
          <div
            style={{
              borderRadius: 18,
              height: 340,
              background: "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="map-skeleton-shimmer" />
          </div>
        </div>
      </div>
    </main>
  );
}
