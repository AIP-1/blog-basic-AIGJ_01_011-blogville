import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@`로 시작하는 폴더는 parallel route라 주소로 못 쓴다. /@주소는 /blog/주소로 잇는다 (BLOG-02).
  async rewrites() {
    return [
      { source: "/@:slug", destination: "/blog/:slug" },
      // 블로그 구독 RSS. 글 번호 주소보다 먼저 둔다
      { source: "/@:slug/rss", destination: "/blog/:slug/rss" },
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
