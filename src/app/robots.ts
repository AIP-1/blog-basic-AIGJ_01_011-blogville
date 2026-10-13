import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/feed";

// 검색엔진용 /robots.txt: 글·블로그는 열고, 회원 전용 화면과 API는 닫는다
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/settings", "/write", "/notifications", "/wallet", "/closet", "/house", "/shop", "/salon", "/clothes", "/farm", "/fishing", "/attendance"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
