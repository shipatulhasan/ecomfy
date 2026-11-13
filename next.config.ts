import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables "use cache", cacheTag and cacheLife. Request-time data (session,
  // cookies) must render inside <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Seed placeholders (public/seed) and future uploads.
    localPatterns: [{ pathname: "/seed/**" }],
    // Google profile avatars from Better Auth social sign-in.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
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
