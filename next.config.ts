import type { NextConfig } from "next";

// M1 試作品は「静的書き出し」で動かします（サーバー不要。データはブラウザ内に保存）。
// M2 で Supabase につないだあとも、Vercel にそのまま置ける構成です。
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
