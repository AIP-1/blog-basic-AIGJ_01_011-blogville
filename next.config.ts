import type { NextConfig } from "next";

// 모든 화면에 붙이는 보안 응답 헤더. 첨부(/files)는 자기 CSP를 따로 붙이므로 CSP만 빼고 같다.
const securityHeaders = [
  // https로 한 번 들어온 브라우저는 1년 동안 이 주소를 https로만 연다 (이 주소에만, 하위 도메인은 그대로)
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // 다른 사이트가 이 사이트를 틀(iframe) 안에 넣어 속이지 못하게
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 다른 사이트로 나갈 때는 주소 전체 대신 사이트 주소만 알린다 (비공개 글 주소가 새지 않게)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()" },
];
// 스크립트는 Next가 화면에 바로 넣는 것이 있어 막지 않고, 틀 넣기·플러그인·base 바꾸기만 막는다
const pageCsp = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // 글자 인식(협찬 배너 그림)은 worker 파일과 한국어 데이터를 node_modules에서 그대로 읽는다
  serverExternalPackages: ["tesseract.js"],
  experimental: {
    // 화면은 모두 로그인한 사람마다 달라 서버가 no-store로 보낸다(맞는 동작). 그래서 브라우저 안 이동은
    // 방금 본 화면으로 돌아가도 매번 서버에 다시 묻는다. 30초 동안은 받아 둔 화면을 바로 다시 보여 준다.
    // 글·댓글·공감 같은 서버 액션은 revalidatePath로 이 기억을 비우므로 내가 바꾼 것은 바로 보인다.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/((?!files/).*)", headers: [{ key: "Content-Security-Policy", value: pageCsp }] },
    ];
  },
  // `@`로 시작하는 폴더는 parallel route라 주소로 못 쓴다. /@주소는 /blog/주소로 잇는다 (BLOG-02).
  async rewrites() {
    return [
      { source: "/@:slug", destination: "/blog/:slug" },
      // 블로그 구독 RSS. 글 번호 주소보다 먼저 둔다
      { source: "/@:slug/rss", destination: "/blog/:slug/rss" },
      // 방명록 (BLOG-10). 이것도 글 번호 주소보다 먼저
      { source: "/@:slug/guestbook", destination: "/blog/:slug/guestbook" },
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
