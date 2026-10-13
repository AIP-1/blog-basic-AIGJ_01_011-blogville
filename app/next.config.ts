import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@`로 시작하는 폴더는 parallel route라 주소로 못 쓴다. /@주소는 /blog/주소로 잇는다 (BLOG-02).
  async rewrites() {
    return [
      { source: "/@:slug", destination: "/blog/:slug" },
      { source: "/@:slug/:postId", destination: "/blog/:slug/:postId" },
    ];
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
