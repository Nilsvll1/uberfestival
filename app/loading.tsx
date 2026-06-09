export default function Loading() {
  return (
    <main className="flex-1 overflow-hidden">
      {/* ─── Desktop skeleton ─────────────────────────────────── */}
      <div className="hidden lg:flex" style={{ height: "calc(100vh - 52px)" }}>

        {/* Panel */}
        <div
          style={{
            width: 420,
            flexShrink: 0,
            borderRight: "1px solid rgba(0,0,0,0.07)",
            background: "rgba(249,249,251,0.92)",
            padding: "24px 20px 0",
            overflow: "hidden",
          }}
        >
          <Skel w={110} h={10} r={99} mb={16} />
          <Skel w={200} h={26} r={8}  mb={8}  />
          <Skel w={155} h={26} r={8}  mb={16} />
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <Skel w={104} h={26} r={99} mb={0} />
            <Skel w={88}  h={26} r={99} mb={0} />
          </div>
          <Skel w="100%" h={34} r={10} mb={8} />
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            <Skel w={90} h={28} r={99} mb={0} />
            <Skel w={80} h={28} r={99} mb={0} />
            <Skel w={80} h={28} r={99} mb={0} style={{ marginLeft: "auto" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2, 3].map(i => <CardSkeleton key={i} delay={i * 60} />)}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, background: "#e8edf2", position: "relative", overflow: "hidden" }}>
          <div className="map-skeleton-shimmer" />
          {[[38,52],[42,56],[35,48],[45,44],[52,58],[30,62],[48,38],[60,50]].map(([t,l], i) => (
            <div key={i} style={{
              position: "absolute", top: `${t}%`, left: `${l}%`,
              width: 12, height: 12, borderRadius: "50%",
              background: "rgba(99,102,241,0.22)",
              border: "2.5px solid rgba(255,255,255,0.75)",
              transform: "translate(-50%,-50%)",
            }} />
          ))}
        </div>
      </div>

      {/* ─── Mobile skeleton ──────────────────────────────────── */}
      <div className="lg:hidden flex flex-col">
        <div style={{ height: "45vh", background: "#e8edf2", position: "relative", overflow: "hidden" }}>
          <div className="map-skeleton-shimmer" />
        </div>
        <div style={{ padding: "12px 16px 0" }}>
          <Skel w="100%" h={34} r={10} mb={8} />
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Skel w={90} h={28} r={99} mb={0} />
            <Skel w={80} h={28} r={99} mb={0} />
          </div>
        </div>
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map(i => <CardSkeleton key={i} delay={i * 60} />)}
        </div>
      </div>
    </main>
  );
}

function Skel({ w, h, r, mb, style }: { w: number | string; h: number; r: number; mb: number; style?: React.CSSProperties }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "rgba(0,0,0,0.07)", marginBottom: mb, flexShrink: 0, ...style }} />
  );
}

function CardSkeleton({ delay }: { delay: number }) {
  return (
    <div style={{
      borderRadius: 18, border: "1px solid rgba(0,0,0,0.07)", background: "#fff", overflow: "hidden",
      animation: `fadeUp 360ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both`,
    }}>
      <div style={{ height: 200, background: "linear-gradient(135deg, #e8edf2 0%, #dde3ea 100%)", position: "relative", overflow: "hidden" }}>
        <div className="map-skeleton-shimmer" />
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ height: 15, width: "68%", borderRadius: 6, background: "rgba(0,0,0,0.08)", marginBottom: 8 }} />
        <div style={{ height: 11, width: "40%", borderRadius: 6, background: "rgba(0,0,0,0.05)", marginBottom: 16 }} />
        <div style={{ height: 1, background: "rgba(0,0,0,0.06)", marginBottom: 12 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ height: 11, width: "28%", borderRadius: 6, background: "rgba(0,0,0,0.05)" }} />
          <div style={{ height: 28, width: 58, borderRadius: 7, background: "rgba(99,102,241,0.14)" }} />
        </div>
      </div>
    </div>
  );
}
