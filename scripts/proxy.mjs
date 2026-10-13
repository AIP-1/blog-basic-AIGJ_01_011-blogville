// 무중단 배포용 앞단 프록시 (deploy/run.sh가 blogville-proxy 컨테이너로 띄운다).
// 8400번 포트로 받은 요청을 지금 켜져 있는 앱(블루 8401 / 그린 8402)으로 넘긴다.
// 어느 쪽인지는 ACTIVE_FILE(기본 /state/active-port)에 적힌 포트 번호로 정하고, 파일이 바뀌면 다음 요청부터 바로 따른다.
// 이미 들어온 요청은 원래 앱에서 끝까지 처리된다. 외부 모듈 없이 node:http만 쓴다.
import http from "node:http";
import net from "node:net";
import { readFileSync, statSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 8400);
const ACTIVE_FILE = process.env.ACTIVE_FILE ?? "/state/active-port";

let target = 0;
let seen = 0;
function upstream() {
  try {
    const { mtimeMs } = statSync(ACTIVE_FILE);
    if (mtimeMs !== seen) {
      const port = Number(readFileSync(ACTIVE_FILE, "utf8").trim());
      if (Number.isInteger(port) && port > 0 && port < 65536) {
        if (port !== target) console.log(`${new Date().toISOString()} 앱 포트 → ${port}`);
        target = port;
      }
      seen = mtimeMs;
    }
  } catch {
    // 파일이 잠깐 없으면 마지막으로 알던 포트를 쓴다
  }
  return target;
}

const agent = new http.Agent({ keepAlive: true, maxSockets: 256 });

const server = http.createServer((req, res) => {
  const port = upstream();
  if (!port) {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    res.end("앱을 준비하고 있어요. 잠시 뒤 다시 열어 주세요.");
    return;
  }
  const up = http.request(
    { host: "127.0.0.1", port, method: req.method, path: req.url, headers: req.headers, agent },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.rawHeaders);
      r.pipe(res);
    },
  );
  up.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("앱에 연결하지 못했어요. 잠시 뒤 다시 열어 주세요.");
  });
  req.pipe(up);
});

// 웹소켓 같은 연결 올리기(upgrade)도 그대로 잇는다
server.on("upgrade", (req, socket, head) => {
  const port = upstream();
  if (!port) return socket.destroy();
  const up = net.connect(port, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join("\r\n") + "\r\n\r\n");
    if (head?.length) up.write(head);
    up.pipe(socket).pipe(up);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

server.keepAliveTimeout = 65_000;
server.listen(PORT, () => console.log(`프록시 :${PORT} → ${ACTIVE_FILE}의 포트 (지금 ${upstream() || "없음"})`));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.close(() => process.exit(0)));
