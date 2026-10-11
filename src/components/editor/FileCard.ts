import { mergeAttributes, Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";

/** 이 사이트의 `/files/키` 사진만 받는다. 다른 사이트·data: 사진은 붙여 넣어도 들어오지 않는다 (POST-07). */
export const SiteImage = Image.extend({
  parseHTML() {
    return [{ tag: 'img[src^="/files/"]' }];
  },
}).configure({ allowBase64: false, HTMLAttributes: { alt: "" } });

/**
 * 파일 카드 (POST-09). 글자 없는 `<a data-file>`이고 이름·크기는 CSS가 속성으로 그린다.
 * 그래서 글자 수에 들어가지 않는다. 화면 낭독기는 aria-label을 읽는다.
 */
export const FileCard = Node.create({
  name: "fileCard",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    const attr = (name: string) => ({ default: null, parseHTML: (el: HTMLElement) => el.getAttribute(name), renderHTML: () => ({}) });
    return { href: attr("href"), name: attr("data-name"), size: attr("data-size"), sizeLabel: attr("data-size-label"), ext: attr("data-ext") };
  },

  parseHTML() {
    return [{ tag: 'a[data-file][href^="/files/"]', priority: 60 }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { href, name, size, sizeLabel, ext } = node.attrs;
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href,
        "data-file": "",
        "data-name": name,
        "data-size": size,
        "data-size-label": sizeLabel,
        "data-ext": ext,
        "aria-label": `${name} 내려받기 (${sizeLabel})`,
      }),
    ];
  },
});
