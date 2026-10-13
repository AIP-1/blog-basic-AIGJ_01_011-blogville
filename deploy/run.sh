#!/usr/bin/env bash
# 서버에서 Blogville 도커 이미지를 불러와 8400번 포트로 실행한다.
# GitHub Actions(.github/workflows/deploy.yml)가 이미지 파일과 이 스크립트를 올린 뒤 SSH로 부른다.
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
set -euo pipefail

PORT=8400
NAME=blogville
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

mkdir -p "$DEPLOY_DIR/uploads"
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
if ! "${DOCKER[@]}" run --rm --env-file "$DEPLOY_DIR/app.env" "$IMAGE" node -e '
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
sql`select current_user, current_schema(), version()`
  .then(([r]) => { console.log("DB 접속 됨:", r.current_user, "/ 스키마", r.current_schema, "/", r.version.split(" on ")[0]); return sql.end(); })
  .catch((e) => { console.error("DB 접속 실패:", e.code || "", e.message); process.exit(1); });
'; then
  echo "DB에 접속하지 못해 배포를 멈춰요. 위 오류를 보고 DB 시크릿(주소·포트·DB 이름·아이디·DB_PASSWORD)을 확인해 주세요." >&2
  exit 1
fi

echo "이전 컨테이너 정리"
"${DOCKER[@]}" rm -f "$NAME" >/dev/null 2>&1 || true

echo "컨테이너 실행 (포트 $PORT)"
"${DOCKER[@]}" run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --env-file "$DEPLOY_DIR/app.env" \
  -p "$PORT:$PORT" \
  -v "$DEPLOY_DIR/uploads:/app/storage/uploads" \
  "$IMAGE" >/dev/null

# 마이그레이션을 마치고 서버가 뜰 때까지 기다린다 (최대 2분)
for _ in $(seq 1 60); do
  if [ "$("${DOCKER[@]}" inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != "true" ]; then
    break
  fi
  if "${DOCKER[@]}" exec "$NAME" node -e "fetch('http://127.0.0.1:$PORT/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "배포 완료: $APP_URL"
    rm -f "$TAR"
    # 지금 쓰는 것 말고 남은 blogville 이미지는 지운다
    "${DOCKER[@]}" images blogville --format '{{.Repository}}:{{.Tag}}' | grep -vx "$IMAGE" | xargs -r "${DOCKER[@]}" rmi >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "서버가 뜨지 않았어요. 컨테이너 로그:" >&2
"${DOCKER[@]}" logs --tail 50 "$NAME" >&2 || true
exit 1
