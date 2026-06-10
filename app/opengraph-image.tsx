import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import path from "path";

export const size         = { width: 1200, height: 630 };
export const contentType  = "image/png";

export default function OGImage() {
  const logoData = readFileSync(path.join(process.cwd(), "public/logo-cropped.png"));
  const logoSrc  = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#F5F5F7",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "0 100px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glow — top right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo */}
        <img
          src={logoSrc}
          style={{ width: 320, height: 53, objectFit: "contain", objectPosition: "left" }}
        />

        {/* Divider */}
        <div
          style={{
            width: 48,
            height: 3,
            background: "linear-gradient(90deg, #6366F1, #818CF8)",
            borderRadius: 99,
            marginTop: 40,
            display: "flex",
          }}
        />

        {/* Headline */}
        <div
          style={{
            marginTop: 28,
            fontSize: 64,
            fontWeight: 800,
            color: "#09090B",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            display: "flex",
          }}
        >
          Your next opportunity
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#6366F1",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            display: "flex",
          }}
        >
          starts here.
        </div>

        {/* Sub-tagline */}
        <div
          style={{
            marginTop: 24,
            fontSize: 26,
            color: "#70707B",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            display: "flex",
          }}
        >
          Open calls for artists worldwide
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #818CF8 0%, #6366F1 50%, #5254E8 100%)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
