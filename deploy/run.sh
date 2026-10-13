#!/usr/bin/env bash
# 서버에서 Blogville 도커 이미지를 불러와 8400번 포트로 **무중단(블루·그린)** 배포한다.
# GitHub Actions(.github/workflows/deploy.yml)가 이미지 파일과 이 스크립트를 올린 뒤 SSH로 부른다.
#
# 이 서버의 도커는 다른 사람도 같이 쓴다. 컨테이너·이미지 이름은 모두 bv8400- 로 시작해 겹치지 않게 한다.
# 구성 (모두 --network host)
#   bv8400-proxy  8400번 포트. state/active-port에 적힌 포트의 앱으로 요청을 넘긴다 (scripts/proxy.mjs)
#   bv8400-blue   8401번 포트의 앱
#   bv8400-green  8402번 포트의 앱
# 순서: 쉬고 있는 색에 새 버전을 띄움 → 그 포트에서 응답 확인 → active-port를 바꿔 프록시가 넘김
#       → 이전 색은 하던 요청을 마칠 시간(DRAIN초)을 준 뒤 멈춘다. 새 버전이 뜨지 않으면 이전 버전이 그대로 서비스한다.
#
# 받는 환경 변수
#   DATABASE_URL  (필수) postgres://아이디:비밀번호@주소:포트/DB이름?search_path=스키마
#   IMAGE         (필수) 불러올 이미지 이름:태그 (예: blogville:1a2b3c4)
#   APP_URL       (선택) 사용자가 여는 주소. 없으면 http://<서버 주소>:8400
#   DEPLOY_DIR    (선택) 기본 ~/blogville
#
# 서버에 남는 것 (DEPLOY_DIR 아래)
#   auth-secret   처음 한 번 만든 로그인 비밀키. 지우면 모든 로그인이 풀린다
#   app.env       컨테이너 환경 변수 (권한 600)
#   uploads/      올린 사진·파일
#   state/        active(blue|green), active-port (프록시가 읽음)
set -euo pipefail

PORT=8400
DRAIN=15
APP=bv8400
PROXY=$APP-proxy
REPO=$APP-blogville   # 이미지 이름 (deploy.yml과 같게)
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/blogville}"
TAR="$DEPLOY_DIR/blogville-image.tar.gz"

: "${DATABASE_URL:?DATABASE_URL이 없어요}"
: "${IMAGE:?IMAGE가 없어요}"

# docker 권한이 없으면 sudo(비밀번호 없이)로 쓴다
DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if sudo -n docker info >/dev/null 2>&1; then
    DOCKER=(sudo -n docker)
  else
    echo "docker를 쓸 수 없어요. 서버에 docker를 설치하고 이 계정을 docker 그룹에 넣어 주세요." >&2
    exit 1
  fi
fi

mkdir -p "$DEPLOY_DIR/uploads" "$DEPLOY_DIR/state"
# 컨테이너는 node(1000) 계정으로 돈다
chmod 777 "$DEPLOY_DIR/uploads" 2>/dev/null || true

if [ ! -s "$DEPLOY_DIR/auth-secret" ]; then
  (umask 077 && head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$DEPLOY_DIR/auth-secret")
fi

if [ -z "${APP_URL:-}" ]; then
  APP_URL="http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT"
fi

(umask 077 && cat > "$DEPLOY_DIR/app.env" <<EOF
DATABASE_URL=$DATABASE_URL
BETTER_AUTH_SECRET=$(cat "$DEPLOY_DIR/auth-secret")
BETTER_AUTH_URL=$APP_URL
UPLOAD_DIR=storage/uploads
EOF
)

echo "이미지 불러오기: $IMAGE"
gunzip -c "$TAR" | "${DOCKER[@]}" load

# drizzle-kit migrate는 접속 오류를 보여 주지 않아서, 띄우기 전에 DB 접속을 따로 확인한다
echo "DB 접속 확인"
if ! "${DOCKER[@]}" run --rm --network host --env-file "$DEPLOY_DIR/app.env" "$IMAGE" node -e '
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
sql`select current_user, current_schema(), version()`
  .then(([r]) => { console.log("DB 접속 됨:", r.current_user, "/ 스키마", r.current_schema, "/", r.version.split(" on ")[0]); return sql.end(); })
  .catch((e) => { console.error("DB 접속 실패:", e.code || "", e.message); process.exit(1); });
'; then
  echo "DB에 접속하지 못해 배포를 멈춰요. 위 오류를 보고 DB 시크릿(주소·포트·DB 이름·아이디·DB_PASSWORD)을 확인해 주세요." >&2
  exit 1
fi

# 지금 서비스 중인 색과 이번에 띄울 색
ACTIVE=$(cat "$DEPLOY_DIR/state/active" 2>/dev/null || true)
if [ "$ACTIVE" = "blue" ]; then NEXT=green; NEXT_PORT=8402; else NEXT=blue; NEXT_PORT=8401; fi
NEXT_NAME="$APP-$NEXT"

# 우리가 만든 컨테이너인지 이미지 이름으로 확인한 뒤에만 지운다 (다른 사람 컨테이너는 건드리지 않음)
ours() { case "$("${DOCKER[@]}" inspect -f '{{.Config.Image}}' "$1" 2>/dev/null)" in blogville:*|"$REPO":*) return 0 ;; *) return 1 ;; esac; }
# 무중단 배포 전·첫 시도 때 쓰던 이름 (blogville = 8400 직접, blogville-blue = 8401)
for old in blogville-blue blogville-green; do ours "$old" && "${DOCKER[@]}" rm -f "$old" >/dev/null 2>&1 || true; done

# 띄울 포트를 다른 프로그램이 쓰고 있으면 멈춘다
if ! ours "$NEXT_NAME" && (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -qE "[:.]$NEXT_PORT\b"; then
  echo "$NEXT_PORT 포트를 이미 다른 프로그램이 쓰고 있어요. 지금 서비스는 그대로예요." >&2
  exit 1
fi

# 도커 기본 네트워크(bridge)에서는 이 서버의 공인 IP(DB)로 가는 길이 막혀 있어서(EHOSTUNREACH) 서버 네트워크를 그대로 쓴다
echo "새 버전을 $NEXT($NEXT_PORT)에 띄워요 (지금 서비스: ${ACTIVE:-없음})"
ours "$NEXT_NAME" && "${DOCKER[@]}" rm -f "$NEXT_NAME" >/dev/null 2>&1 || true
"${DOCKER[@]}" run -d \
  --name "$NEXT_NAME" \
  --restart unless-stopped \
  --env-file "$DEPLOY_DIR/app.env" \
  -e PORT="$NEXT_PORT" \
  --network host \
  -v "$DEPLOY_DIR/uploads:/app/storage/uploads" \
  "$IMAGE" >/dev/null

# 마이그레이션을 마치고 새 버전이 뜰 때까지 기다린다 (최대 2분)
ready=""
for _ in $(seq 1 60); do
  if [ "$("${DOCKER[@]}" inspect -f '{{.State.Running}}' "$NEXT_NAME" 2>/dev/null)" != "true" ]; then
    break
  fi
  if "${DOCKER[@]}" exec "$NEXT_NAME" node -e "fetch('http://127.0.0.1:$NEXT_PORT/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "새 버전이 뜨지 않아서 바꾸지 않았어요. 지금 서비스(${ACTIVE:-없음})는 그대로예요. 새 버전 로그:" >&2
  "${DOCKER[@]}" logs --tail 50 "$NEXT_NAME" >&2 || true
  "${DOCKER[@]}" rm -f "$NEXT_NAME" >/dev/null 2>&1 || true
  exit 1
fi
echo "새 버전 응답 확인"

# 프록시가 넘길 포트를 바꾼다 (파일을 통째로 바꿔 반쯤 쓴 내용을 읽지 않게)
printf '%s\n' "$NEXT_PORT" > "$DEPLOY_DIR/state/active-port.tmp"
mv -f "$DEPLOY_DIR/state/active-port.tmp" "$DEPLOY_DIR/state/active-port"
chmod 644 "$DEPLOY_DIR/state/active-port"

# 프록시가 없으면 띄운다. 무중단 배포 전 컨테이너(blogville, 8400 직접 사용)가 있으면 이번 한 번만 바꾸며 잠깐 끊긴다
if [ "$("${DOCKER[@]}" inspect -f '{{.State.Running}}' "$PROXY" 2>/dev/null)" != "true" ]; then
  ours blogville && "${DOCKER[@]}" rm -f blogville >/dev/null 2>&1 || true
  ours "$PROXY" && "${DOCKER[@]}" rm -f "$PROXY" >/dev/null 2>&1 || true
  echo "프록시를 띄워요 (포트 $PORT)"
  "${DOCKER[@]}" run -d \
    --name "$PROXY" \
    --restart unless-stopped \
    -e PORT="$PORT" \
    -e ACTIVE_FILE=/state/active-port \
    --network host \
    -v "$DEPLOY_DIR/state:/state:ro" \
    "$IMAGE" node scripts/proxy.mjs >/dev/null
fi

# 프록시를 거쳐 새 버전이 나오는지 확인한다
ok=""
for _ in $(seq 1 15); do
  if "${DOCKER[@]}" exec "$PROXY" node -e "fetch('http://127.0.0.1:$PORT/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ok=1
    break
  fi
  sleep 1
done
if [ -z "$ok" ]; then
  echo "프록시($PORT)가 응답하지 않아요. 프록시 로그:" >&2
  "${DOCKER[@]}" logs --tail 30 "$PROXY" >&2 || true
  exit 1
fi
echo "$NEXT" > "$DEPLOY_DIR/state/active"
echo "배포 완료: $APP_URL ($NEXT, 포트 $NEXT_PORT)"

# 이전 색은 하던 요청을 마칠 시간을 주고 멈춘다
if [ -n "$ACTIVE" ] && [ "$ACTIVE" != "$NEXT" ]; then
  sleep "$DRAIN"
  "${DOCKER[@]}" stop -t 20 "$APP-$ACTIVE" >/dev/null 2>&1 || true
  "${DOCKER[@]}" rm -f "$APP-$ACTIVE" >/dev/null 2>&1 || true
  echo "이전 버전($ACTIVE) 정리"
fi

rm -f "$TAR"
# 우리 이미지($REPO) 중 돌고 있는 컨테이너(프록시 포함)가 쓰지 않는 것은 지운다
in_use=$("${DOCKER[@]}" ps --format '{{.Image}}' | sort -u)
"${DOCKER[@]}" images "$REPO" --format '{{.Repository}}:{{.Tag}}' | grep -vxF "$in_use" | xargs -r "${DOCKER[@]}" rmi >/dev/null 2>&1 || true
