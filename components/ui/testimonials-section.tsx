"use client";
import React from "react";
import { motion } from "motion/react";
import { TestimonialsColumn } from "@/components/ui/testimonials-columns-1";

const testimonials = [
  {
    text: "Found two festivals in Germany through UberFestival that weren't even on my radar. One of them ended up being one of the best gigs I played all year.",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Léa Dupont",
    role: "Electronic Producer",
  },
  {
    text: "I used to save open calls in random spreadsheets and forget about them. This is way easier — I can see what's closing soon without digging through folders.",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "James Okafor",
    role: "Touring DJ",
  },
  {
    text: "Most opportunities are scattered across dozens of different websites. Having everything in one place saves me hours every week.",
    image: "https://randomuser.me/api/portraits/women/63.jpg",
    name: "Sofia Martínez",
    role: "Jazz Vocalist",
  },
  {
    text: "The deadline tracking is what keeps me coming back. I was missing applications constantly just because I lost track of dates.",
    image: "https://randomuser.me/api/portraits/men/52.jpg",
    name: "Tom Bradley",
    role: "Indie Rock Singer",
  },
  {
    text: "Managing open call applications for five artists at once is a lot. Having all of them in one place makes it actually manageable.",
    image: "https://randomuser.me/api/portraits/women/29.jpg",
    name: "Yuki Tanaka",
    role: "Artist Manager",
  },
  {
    text: "Applied to three festivals in my first week. Two of them I wouldn't have found on my own. One is now a regular booking.",
    image: "https://randomuser.me/api/portraits/men/71.jpg",
    name: "Amara Diallo",
    role: "Afrobeats Producer",
  },
  {
    text: "I always assumed most open calls were in Europe or the US. The map showed me there are serious opportunities in places I'd never thought to look.",
    image: "https://randomuser.me/api/portraits/men/14.jpg",
    name: "Mats Eriksson",
    role: "Live Performer",
  },
  {
    text: "Found a residency in Portugal that I applied to on the last day. Got in. That doesn't happen without the deadline alerts.",
    image: "https://randomuser.me/api/portraits/women/17.jpg",
    name: "Rachel Kim",
    role: "Singer-Songwriter",
  },
  {
    text: "I coordinate bookings for a small agency. This is the first tool I've seen that's actually built with artists in mind rather than venues.",
    image: "https://randomuser.me/api/portraits/men/88.jpg",
    name: "Carlos Fuentes",
    role: "Booking Coordinator",
  },
  {
    text: "I was spending Sunday afternoons trawling through festival websites. Now I check UberFestival once and I'm done in ten minutes.",
    image: "https://randomuser.me/api/portraits/women/55.jpg",
    name: "Ingrid Halvorsen",
    role: "Folk Musician",
  },
  {
    text: "Saved a bunch of festivals in Southeast Asia I never would have found otherwise. Already confirmed two dates from those for next year.",
    image: "https://randomuser.me/api/portraits/men/36.jpg",
    name: "Dev Sharma",
    role: "Electronic Artist",
  },
  {
    text: "As a programmer I also use it to track what other festivals are doing internationally. Good to see the full circuit in one view.",
    image: "https://randomuser.me/api/portraits/women/82.jpg",
    name: "Chiara Rossi",
    role: "Festival Programmer",
  },
];

const firstColumn = testimonials.slice(0, 4);
const secondColumn = testimonials.slice(4, 8);
const thirdColumn = testimonials.slice(8, 12);

export function TestimonialsSection() {
  return (
    <section
      className="testimonials-section relative overflow-hidden"
      style={{ background: "#06060A", paddingTop: "5rem", paddingBottom: "6rem" }}
    >
      <div className="max-w-2xl mx-auto px-6 text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-8"
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <span
              className="font-medium uppercase"
              style={{
                fontSize: "10.5px",
                color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.10em",
              }}
            >
              From the community
            </span>
          </div>

          <h2
            className="font-extrabold tracking-tight mb-4"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              color: "#fff",
              letterSpacing: "-0.03em",
            }}
          >
            Artists are finding their stages.
          </h2>
          <p
            className="leading-relaxed"
            style={{ fontSize: "15px", color: "rgba(255,255,255,0.38)" }}
          >
            See what musicians, DJs, and booking managers are saying about
            UberFestival.
          </p>
        </motion.div>
      </div>

      <div
        className="flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]"
        style={{ maxHeight: 680, overflow: "hidden" }}
      >
        <TestimonialsColumn testimonials={firstColumn} duration={19} />
        <TestimonialsColumn
          testimonials={secondColumn}
          duration={17}
          className="hidden md:block"
        />
        <TestimonialsColumn
          testimonials={thirdColumn}
          duration={21}
          className="hidden lg:block"
        />
      </div>
    </section>
  );
}
