import { ATTACH_MESSAGES as M, attachmentProblem, cleanFileName, formatBytes, REQUEST_MAX_BYTES, sniffImage, typeOf } from "@/lib/attachments";
import { createAttachment } from "@/server/attachments";
import { getSession } from "@/server/dal";

// 사진·파일 올리기 (POST-07·09, contracts/routes.md). 30MB까지 받아야 해서
// 본문 1MB 상한이 있는 Server Action 대신 Route Handler를 쓰고, Origin 확인을 직접 한다 (NF-12).

const fail = (status: number, error: string) => Response.json({ error }, { status });

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || origin === "null" || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, M.invalid);
  const member = await getSession();
  if (!member) return fail(401, M.login);

  const length = req.headers.get("content-length");
  if (length === null) return fail(411, M.invalid);
  if (Number(length) > REQUEST_MAX_BYTES) return fail(413, M.fileTooBig);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail(400, M.invalid);
  }
  if (!(file instanceof File)) return fail(400, M.invalid);

  const name = cleanFileName(file.name);
  const type = name ? typeOf(name) : null;
  if (!type) return fail(415, M.badType);
  const problem = attachmentProblem(name, file.size);
  if (problem) return fail(problem === M.empty ? 400 : 413, problem);

  const data = new Uint8Array(await file.arrayBuffer());
  if (type.kind === "image" && !sniffImage(type.ext, data.subarray(0, 12))) return fail(415, M.notImage);

  const row = await createAttachment(member.userId, { kind: type.kind, name, mime: type.mime, data });
  return Response.json(
    { key: row.key, url: `/files/${row.key}`, kind: row.kind, name: row.name, size: row.size, sizeLabel: formatBytes(row.size), ext: type.ext },
    { status: 201 },
  );
}
