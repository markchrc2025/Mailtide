/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // mysql2 is a server-only dependency; never bundle it for the client.
    serverComponentsExternalPackages: ["mysql2", "bcryptjs"],
  },
};

export default nextConfig;
