/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid bundling pdf-parse/mammoth so we don't get "Object.defineProperty called on non-object" (webpack ESM issue)
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;
