import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer leakage control
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Feature Policy — lock down browser APIs
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
  // HSTS — enforce HTTPS (Vercel also does this, belt-and-suspenders)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Prevent cross-origin info leaks
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Don't advertise Next.js version in response headers
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    // Allowlist external image sources used by festival hero images and scraper
    remotePatterns: [
      // Supabase storage (hero images uploaded via enrichment pipeline)
      { protocol: "https", hostname: "*.supabase.co" },
      // Wikipedia / Wikimedia (image enrichment)
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // Common festival image CDNs seen in scraper output
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "*.imgix.net" },
    ],
  },
};

export default nextConfig;
