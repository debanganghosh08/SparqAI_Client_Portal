import type { NextConfig } from "next";

/** Headers that never vary by request. The Content-Security-Policy is not here:
 *  it carries a per-request nonce and is set in middleware. */
const SECURITY_HEADERS = [
  // The portal is never meant to be framed; approving a deliverable or deleting
  // a client is one click, and that is exactly what clickjacking needs.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Client names and project ids live in portal URLs, so they do not travel.
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/** Only sent in production: over plain http on localhost it would pin the dev
 *  machine to https for two years. */
const HSTS = { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" };

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // The dev badge lands on top of the sidebar account menu.
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: process.env.NODE_ENV === "production" ? [...SECURITY_HEADERS, HSTS] : SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
