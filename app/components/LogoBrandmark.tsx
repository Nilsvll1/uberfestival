"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LogoBrandmark({ name, href = "/" }: { name: string; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 select-none" style={{ textDecoration: "none" }}>
      <motion.div
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          overflow: "hidden",
          flexShrink: 0,
          boxShadow:
            "0 1px 3px rgba(99,102,241,0.22), 0 0 0 1px rgba(99,102,241,0.08)",
        }}
      >
        <Image
          src="/logo-icon.png"
          alt=""
          width={28}
          height={28}
          priority
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </motion.div>

      <span
        className="font-semibold tracking-tight"
        style={{
          fontSize: "14.5px",
          letterSpacing: "-0.015em",
          color: "var(--text-primary)",
        }}
      >
        {name}
      </span>
    </Link>
  );
}
