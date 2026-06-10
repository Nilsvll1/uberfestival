"use client";

import { useCallback } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function DetailHero({
  children,
  imageUrl,
  gradient,
  festivalId,
}: {
  children: React.ReactNode;
  imageUrl: string;
  gradient: string;
  festivalId: number;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  // Slow spring = premium lag feel (Apple/Linear style)
  const springX = useSpring(mouseX, { stiffness: 50, damping: 28, restDelta: 0.001 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 28, restDelta: 0.001 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
      // Map cursor to [-1, 1] range, invert for counter-movement feel
      mouseX.set(((e.clientX - left) / width - 0.5) * -8);   // max ±4px
      mouseY.set(((e.clientY - top) / height - 0.5) * -6);   // max ±3px
    },
    [mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{ height: "62vh", minHeight: 420, maxHeight: 720 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Gradient placeholder — shows instantly, right color family */}
      <div className="absolute inset-0" style={{ background: gradient }} />

      {/* Hero photo: shared element with card + mouse parallax
          Oversized by 8px on each side so parallax never reveals edges */}
      <motion.img
        layoutId={`festival-img-${festivalId}`}
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className="absolute object-cover pointer-events-none"
        style={{
          top: "-8px",
          left: "-8px",
          width: "calc(100% + 16px)",
          height: "calc(100% + 16px)",
          x: springX,
          y: springY,
        }}
        transition={{
          layout: { type: "spring", stiffness: 200, damping: 26, restDelta: 0.001 },
        }}
      />

      {/* Cinematic overlay fades in after image arrives */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.88) 100%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }}
      />

      {/* Back button + hero content */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
