"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.7, 0.9] : [1.05, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      className="h-[60rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20"
      ref={containerRef}
    >
      <div
        className="py-10 md:py-40 w-full relative"
        style={{ perspective: "1000px" }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({ translate, titleComponent }: any) => {
  return (
    <motion.div
      style={{ translateY: translate }}
      className="div max-w-5xl mx-auto text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{ rotateX: rotate, scale }}
      className="max-w-5xl -mt-12 mx-auto relative"
    >

      {/* ── Shadows ─────────────────────────────────────────────── */}

      {/* Contact shadow — device is physically resting on a surface */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -5,
          left: "8%",
          right: "8%",
          height: 28,
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.44) 48%, transparent 72%)",
          filter: "blur(9px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Mid shadow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -32,
          left: "4%",
          right: "4%",
          height: 80,
          background:
            "radial-gradient(ellipse at 50% 80%, rgba(0,0,0,0.58) 0%, transparent 70%)",
          filter: "blur(22px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Screen color bloom — light emitted by the UI itself */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -90,
          left: "16%",
          right: "16%",
          height: 170,
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.62) 0%, rgba(59,130,246,0.20) 42%, transparent 72%)",
          filter: "blur(46px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Wide ambient scatter */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -140,
          left: "-2%",
          right: "-2%",
          height: 200,
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(67,56,202,0.24) 0%, rgba(37,99,235,0.08) 50%, transparent 72%)",
          filter: "blur(58px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── Lid (screen) ──────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          borderRadius: "14px 14px 0 0",
          padding: "4px 4px 0",
          // Three stacked backgrounds simulate anisotropic brushed aluminum:
          // 1. Diagonal specular — bright stripe crossing the frame body
          // 2. Lateral anisotropy — left edge catches light first
          // 3. Primary aluminum — 8-stop Apple Space Gray gradient
          background: [
            "linear-gradient(160deg, rgba(255,255,255,0) 36%, rgba(255,255,255,0.034) 43%, rgba(255,255,255,0.034) 49%, rgba(255,255,255,0) 56%)",
            "linear-gradient(90deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.016) 9%, rgba(255,255,255,0) 38%, rgba(255,255,255,0.010) 91%, rgba(255,255,255,0.036) 100%)",
            "linear-gradient(180deg, #4A4A4C 0%, #444446 1.5%, #3C3C3E 6%, #363638 18%, #2E2E30 42%, #262628 68%, #1E1E20 86%, #161618 100%)",
          ].join(", "),
          boxShadow: [
            "0 0 0 0.5px rgba(255,255,255,0.16)",
            "0 1px 2px rgba(0,0,0,0.92)",
            "0 5px 14px rgba(0,0,0,0.82)",
            "0 18px 44px rgba(0,0,0,0.72)",
            "0 46px 88px rgba(0,0,0,0.54)",
            "0 0 110px rgba(99,102,241,0.16)",
          ].join(", "),
        }}
      >
        {/* Left chamfer — machined angled edge catching ambient light */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "4%", bottom: 0, left: 0, width: 1,
            background:
              "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.20) 20%, rgba(255,255,255,0.16) 75%, rgba(255,255,255,0.08) 100%)",
            pointerEvents: "none",
          }}
        />
        {/* Right chamfer */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "4%", bottom: 0, right: 0, width: 1,
            background:
              "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.14) 20%, rgba(255,255,255,0.10) 75%, rgba(255,255,255,0.06) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Camera — recessed lens with inner catch light */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 5,
            left: "50%",
            transform: "translateX(-50%)",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "radial-gradient(circle at 32% 30%, #202022 0%, #070708 80%)",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.95), 0 0 0 1.5px rgba(255,255,255,0.08), inset 0 0.5px 0 rgba(255,255,255,0.09)",
            zIndex: 5,
          }}
        />

        {/* Screen */}
        <div
          className="relative overflow-hidden h-[28rem] md:h-[38rem] w-full"
          style={{
            borderRadius: "10px 10px 0 0",
            background: "#000",
            // Layered inner ring: panel-to-bezel gap, panel depth, brand tint
            boxShadow: [
              "inset 0 0 0 0.5px rgba(0,0,0,0.98)",
              "inset 0 0 0 1.5px rgba(0,0,0,0.60)",
              "inset 0 2px 10px rgba(0,0,0,0.26)",
              "inset 0 0 0 2px rgba(99,102,241,0.052)",
            ].join(", "),
          }}
        >
          {children}

          {/* SVG glass — diagonal sweep + overhead radial, more precise than CSS */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 11,
              pointerEvents: "none",
            }}
          >
            <defs>
              <linearGradient id="uf-sweep" x1="0" y1="0" x2="0.50" y2="0.76">
                <stop offset="0%" stopColor="white" stopOpacity="0.082" />
                <stop offset="26%" stopColor="white" stopOpacity="0.030" />
                <stop offset="48%" stopColor="white" stopOpacity="0.008" />
                <stop offset="65%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <radialGradient
                id="uf-overhead"
                cx="40%"
                cy="-8%"
                r="72%"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="white" stopOpacity="0.068" />
                <stop offset="55%" stopColor="white" stopOpacity="0.020" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="100" height="100" fill="url(#uf-sweep)" />
            <rect width="100" height="100" fill="url(#uf-overhead)" />
          </svg>

          {/* LCD panel vignette — edges are darker due to panel thickness */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 84% 78% at 50% 40%, transparent 50%, rgba(0,0,0,0.28) 100%)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />

          {/* Top-edge pixel catch — glass surface edge picks up overhead light */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: "5%",
              right: "5%",
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.16) 20%, rgba(255,255,255,0.16) 80%, transparent)",
              zIndex: 12,
              pointerEvents: "none",
            }}
          />

          {/* Bottom fade — screenshot dissolves, no hard clip */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "22%",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.78) 100%)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* ── Hinge ─────────────────────────────────────────────────── */}
      {/* The mechanical pivot — thinnest, darkest part of the device */}
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          zIndex: 2,
          height: 3,
          background:
            "linear-gradient(180deg, #0E0E10 0%, #181819 55%, #222224 100%)",
          boxShadow:
            "inset 0 1px 3px rgba(0,0,0,0.95), 0 1px 0 rgba(255,255,255,0.05)",
        }}
      />

      {/* ── Keyboard base ─────────────────────────────────────────── */}
      {/* This is what tells the brain "MacBook", not just a floating screen */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          borderRadius: "0 0 10px 10px",
          height: "5.5rem",
          // Base is slightly darker/cooler than the lid — different aluminum plane
          background: [
            "linear-gradient(90deg, rgba(255,255,255,0.030) 0%, rgba(255,255,255,0) 16%, rgba(255,255,255,0) 84%, rgba(255,255,255,0.020) 100%)",
            "linear-gradient(180deg, #2A2A2C 0%, #2E2E30 12%, #2C2C2E 50%, #242426 78%, #1A1A1C 100%)",
          ].join(", "),
          boxShadow: [
            "inset 0 1px 0 rgba(255,255,255,0.07)",
            "0 2px 6px rgba(0,0,0,0.82)",
            "0 10px 32px rgba(0,0,0,0.72)",
            "0 32px 64px rgba(0,0,0,0.52)",
          ].join(", "),
        }}
      >
        {/* Left base chamfer */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0, bottom: "5%", left: 0, width: 1,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.10) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
        {/* Right base chamfer */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0, bottom: "5%", right: 0, width: 1,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Keyboard zone — subtle darker rectangle with row-line texture */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 11,
            left: "7%",
            right: "7%",
            bottom: 26,
            borderRadius: 3,
            background: "rgba(0,0,0,0.14)",
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent, transparent 12px, rgba(0,0,0,0.10) 12px, rgba(0,0,0,0.10) 13px)",
          }}
        />

        {/* Trackpad */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: "26%",
            height: 16,
            borderRadius: 4,
            background: "rgba(0,0,0,0.12)",
            boxShadow:
              "inset 0 0 0 0.5px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.03)",
          }}
        />

        {/* Front bottom edge — the taper facing the viewer */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            borderRadius: "0 0 10px 10px",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.48) 100%)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04)",
          }}
        />
      </div>

      {/* ── Outer highlights ──────────────────────────────────────── */}

      {/* Top rim — the single brightest line; catches overhead light on the lid edge */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: "4%",
          right: "4%",
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 15%, rgba(255,255,255,0.55) 85%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* Left shoulder — catches side-ambient from environment light */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "2%",
          bottom: "8%",
          left: 0,
          width: 2,
          background:
            "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.22) 16%, rgba(255,255,255,0.16) 56%, rgba(255,255,255,0.06) 82%, transparent 100%)",
          borderRadius: 14,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* Right shoulder */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "2%",
          bottom: "8%",
          right: 0,
          width: 2,
          background:
            "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.15) 16%, rgba(255,255,255,0.10) 56%, rgba(255,255,255,0.04) 82%, transparent 100%)",
          borderRadius: 14,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />
    </motion.div>
  );
};
