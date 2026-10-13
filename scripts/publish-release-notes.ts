/**
 * 릴리스 노트(docs/releases/v<버전>.md)를 공지 블로그(/@notice)의 글로 올린다. 여러 번 실행해도 안전하다.
 * 배포할 때 새 버전 컨테이너 안에서 돈다 (deploy/run.sh). 로컬은 `npm run release:post`.
 * - 공지 블로그가 없으면(관리자 계정을 아직 안 만듦) 아무것도 하지 않는다.
 * - 이미 올린 버전(공지 블로그에 같은 제목의 글이 있음)은 건너뛴다. 빠진 버전이 있으면 옛 버전부터 올린다.
 * - 노트의 그림은 첨부 파일(UPLOAD_DIR)로 복사해 글에 붙인다.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { compareVersions, htmlToText, imagePaths, noteTitle, noteToHtml, versionOfFile } from "../src/lib/release-note";

config({ path: ".env.local" });

const NOTES_DIR = path.resolve("docs/releases");
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "storage/uploads");
const REPO = "https://github.com/handsomeguen/blogville/blob/main/";
const CATEGORY = "업데이트";
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };

/** 같은 버전·같은 그림이면 늘 같은 키 (다시 돌려도 파일이 늘지 않게) */
const keyOf = (version: string, rel: string) => createHash("md5").update(`release:${version}:${rel}`).digest("hex");

async function main() {
  const files = (await readdir(NOTES_DIR).catch(() => [])).flatMap((f) => {
    const version = versionOfFile(f);
    return version ? [{ file: f, version }] : [];
  });
  files.sort((a, b) => compareVersions(a.version, b.version));
  if (files.length === 0) return console.log("릴리스 노트가 없어요.");

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const [blog] = await sql`select id, owner_id from blogs where slug = 'notice'`;
    if (!blog) return console.log("공지 블로그(/@notice)가 없어 릴리스 노트를 올리지 않았어요. 관리자 계정을 먼저 만들어 주세요.");

    for (const { file, version } of files) {
      const markdown = await readFile(path.join(NOTES_DIR, file), "utf8");
      const title = noteTitle(markdown, version);
      const [exists] = await sql`select 1 from posts where blog_id = ${blog.id} and title = ${title}`;
      if (exists) continue;

      // 그림을 첨부 폴더로 복사한다
      const images = new Map<string, { key: string; name: string; mime: string; size: number }>();
      await mkdir(UPLOAD_DIR, { recursive: true });
      for (const rel of imagePaths(markdown)) {
        const source = path.resolve(NOTES_DIR, rel);
        if (!source.startsWith(NOTES_DIR + path.sep)) continue;
        const mime = MIME[path.extname(source).toLowerCase()];
        const data = await readFile(source).catch(() => null);
        if (!mime || !data || data.length === 0) continue;
        const key = keyOf(version, rel);
        await writeFile(path.join(UPLOAD_DIR, key), data, { flag: "w" });
        images.set(rel, { key, name: path.basename(source).slice(0, 255), mime, size: data.length });
      }

      const html = noteToHtml(markdown, {
        image: (rel) => (images.has(rel) ? `/files/${images.get(rel)!.key}` : null),
        link: (rel) => REPO + path.posix.normalize(path.posix.join("docs/releases", rel)).replace(/^(\.\.\/)+/, ""),
      });

      await sql.begin(async (tx) => {
        let [category] = await tx`select id from categories where blog_id = ${blog.id} and name = ${CATEGORY}`;
        if (!category) {
          const [{ next }] = await tx`select coalesce(max(position), 0) + 1 as next from categories where blog_id = ${blog.id}`;
          [category] = await tx`insert into categories (blog_id, name, position) values (${blog.id}, ${CATEGORY}, ${next}) returning id`;
        }
        const [post] = await tx`insert into posts (blog_id, category_id, title, content_html, content_text, is_public)
          values (${blog.id}, ${category.id}, ${title}, ${html}, ${htmlToText(html)}, true) returning id`;
        for (const img of images.values()) {
          await tx`insert into attachments (key, user_id, kind, name, mime, size, post_id)
            values (${img.key}, ${blog.owner_id}, 'image', ${img.name}, ${img.mime}, ${img.size}, ${post.id})
            on conflict (key) do update set post_id = excluded.post_id, detached_at = null`;
        }
      });
      console.log(`릴리스 노트 v${version}을 공지 블로그에 올렸어요: ${title}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
