import type { NextConfig } from "next";

/**
 * Product media is served straight from the Neon Object Storage bucket
 * ("uploads", public_read): {AWS_ENDPOINT_URL_S3}/uploads/{key}. Each Neon branch
 * has its own endpoint host, so the pattern is built from the env at build time.
 */
const storage = process.env.AWS_ENDPOINT_URL_S3 ? new URL(process.env.AWS_ENDPOINT_URL_S3) : null;
const storagePattern = storage
  ? [{ protocol: storage.protocol.replace(":", "") as "https" | "http", hostname: storage.hostname, pathname: "/uploads/**" }]
  : [];

const nextConfig: NextConfig = {
  // Enables "use cache", cacheTag and cacheLife. Request-time data (session,
  // cookies) must render inside <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Seed placeholders (public/seed) and future uploads.
    localPatterns: [{ pathname: "/seed/**" }, { pathname: "/api/avatars/**" }],
    // Google profile avatars from Better Auth social sign-in.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }, ...storagePattern],
  },
  experimental: {
    // Settings → "Choose Image" accepts avatars up to 2 MB (lib/actions/account.ts).
    serverActions: { bodySizeLimit: "3mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
