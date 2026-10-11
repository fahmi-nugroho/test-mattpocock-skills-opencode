/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Portfolio / price covers live in Supabase Storage (any project host).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;
