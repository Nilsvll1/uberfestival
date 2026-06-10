"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    // popLayout: exiting page gets position:absolute so the entering page
    // takes normal flow; both coexist briefly so layoutId shared-element
    // transitions can fly the image from card to hero across routes
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        className="flex-1 flex flex-col min-h-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.28, delay: 0.06, ease: "easeOut" } }}
        exit={{ opacity: 0, transition: { duration: 0.14, ease: "easeIn" } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
