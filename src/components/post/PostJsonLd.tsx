import { jsonLdText, postJsonLd, type PostJsonLdInput } from "@/lib/json-ld";

/** 공개 글에만 붙이는 검색 엔진용 구조화 정보 */
export function PostJsonLd(props: PostJsonLdInput) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(postJsonLd(props)) }} />;
}
