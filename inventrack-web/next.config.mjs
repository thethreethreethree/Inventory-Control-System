/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // postgres / drizzle are server-only Node packages; keep them external to the
  // server bundle (Next 14 option name).
  experimental: {
    serverComponentsExternalPackages: ["postgres"],
  },
};

export default nextConfig;
