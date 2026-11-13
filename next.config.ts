import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables "use cache", cacheTag and cacheLife. Request-time data (session,
  // cookies) must render inside <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Seed placeholders (public/seed) and future uploads.
    localPatterns: [{ pathname: "/seed/**" }, { pathname: "/api/avatars/**" }],
    // Google profile avatars from Better Auth social sign-in.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
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
