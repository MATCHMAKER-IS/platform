/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  // 基盤パッケージを Next 側でトランスパイルする
  transpilePackages: ["@platform/datetime", "@platform/utils", 
    "@platform/ui",
    "@platform/core",
    "@platform/logger",
    "@platform/env",
    "@platform/db",
    "@platform/mail",
    "@platform/validation",
  ],
};
