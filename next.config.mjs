/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "mammoth",
      "@xenova/transformers",
      "@huggingface/transformers",
      "onnxruntime-node",
    ],
  },
};

export default nextConfig;
