#!/usr/bin/env bash
# 서버에서 Blogville 도커 이미지를 불러와 8400번 포트로 **무중단(블루·그린)** 배포한다.
# GitHub Actions(.github/workflows/deploy.yml)가 이미지 파일과 이 폴더의 파일들을 올린 뒤 SSH로 부른다.
#
# 이 서버의 도커는 다른 사람도 같이 쓴다. 컨테이너·이미지 이름은 모두 bv8400- 로 시작해 겹치지 않게 한다.
# 구성 (docker compose 프로젝트 bv8400, compose.yml, 모두 서버 네트워크(host) 사용)
#   bv8400-nginx  8400번 포트(PROXY_PORT). nginx/conf.d/upstream.conf에 적힌 앱으로 요청을 넘긴다
#   bv8400-blue   8401번 포트(BLUE_PORT)의 앱
#   bv8400-green  8402번 포트(GREEN_PORT)의 앱
#   포트는 deploy.env(→ 서버의 .env), 비밀 값은 app.env
# 순서: 쉬고 있는 색에 새 버전을 띄움 → 그 포트에서 응답 확인 → upstream.conf를 바꾸고 nginx reload(트래픽 전환)
#       → nginx를 거쳐 새 버전이 답하는지 확인 → 이전 색은 하던 요청을 마칠 시간(DRAIN_SECONDS초)을 준 뒤 멈춘다.
#       새 버전이 뜨지 않으면 이전 버전이 그대로 서비스한다.
#
# 받는 환경 변수
#   DATABASE_URL  (필수) postgres://아이디:비밀번호@주소:포트/DB이름?search_path=스키마
#   IMAGE         (필수) 불러올 이미지 이름:태그 (예: bv8400-blogville:1a2b3c4)
#   APP_URL       (선택) 사용자가 여는 주소. 없으면 http://<서버 주소>:8400
#   DEPLOY_DIR    (선택) 기본 ~/blogville
#   ADMIN_USERNAME, ADMIN_PASSWORD (선택) 있으면 배포할 때 관리자 계정과 공지 블로그(/@notice)를 만들거나 비밀번호를 갱신한다
#   {KAKAO,NAVER,GOOGLE}_CLIENT_ID, _CLIENT_SECRET (선택) 소셜 로그인 키. 둘 다 있는 서비스만 켜진다
#   KAKAO_REST_API_KEY (선택) 🍽 맛집 내 주변·식당 찾기. 카카오맵 사용 설정을 켠 앱의 REST API 키
#   KAKAO_JS_KEY (선택) 🍽 맛집 🗺 지도. 같은 앱의 JavaScript 키 (사이트 도메인 등록 필요)
#   FEEDBACK_BOT_TOKEN (선택) 버그·문의 자동 처리 API(/api/feedback)의 열쇠. 32자 이상이면 켜진다
#
# 서버에 남는 것 (DEPLOY_DIR 아래)
#   compose.yml, deploy.env, nginx/   이 저장소 deploy/에서 올라온 것
#   .env          compose가 읽는 값 (deploy.env + 색마다 띄운 이미지)
#   auth-secret   처음 한 번 만든 로그인 비밀키. 지우면 모든 로그인이 풀린다
#   app.env       앱 컨테이너 환경 변수 (권한 600)
#   uploads/      올린 사진·파일
#   nginx/conf.d/ nginx 설정 (upstream.conf = 지금 서비스 중인 앱 포트)
#   state/active  지금 서비스 중인 색 (blue|green)
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/blogville}"
TAR="$DEPLOY_DIR/blogville-image.tar.gz"
. "$DEPLOY_DIR/common.sh"
PORT=$PROXY_PORT

: "${DATABASE_URL:?DATABASE_URL이 없어요}"
: "${IMAGE:?IMAGE가 없어요}"

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
# 소셜 로그인 키 (AUTH-01): 값이 있는 것만 넣는다
for k in KAKAO_CLIENT_ID KAKAO_CLIENT_SECRET NAVER_CLIENT_ID NAVER_CLIENT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  v="${!k:-}"
  if [ -n "$v" ]; then printf '%s=%s\n' "$k" "$v" >> "$DEPLOY_DIR/app.env"; fi
done
# 📰 뉴스 위젯·🔎 키워드 도우미·🍽 맛집 (NAVER API HUB, 카카오 로컬): 값이 있는 것만
for k in NAVER_SEARCH_CLIENT_ID NAVER_SEARCH_CLIENT_SECRET NAVER_TREND_CLIENT_ID NAVER_TREND_CLIENT_SECRET KAKAO_REST_API_KEY KAKAO_JS_KEY; do
  v="${!k:-}"
  if [ -n "$v" ]; then printf '%s=%s\n' "$k" "$v" >> "$DEPLOY_DIR/app.env"; fi
done
# 버그·문의 자동 처리 API 열쇠 (SUP-04): 있을 때만 넣는다
if [ -n "${FEEDBACK_BOT_TOKEN:-}" ]; then printf 'FEEDBACK_BOT_TOKEN=%s\n' "$FEEDBACK_BOT_TOKEN" >> "$DEPLOY_DIR/app.env"; fi

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
if [ "$ACTIVE" = "blue" ]; then NEXT=green; else NEXT=blue; fi
NEXT_PORT=$(color_port "$NEXT")
NEXT_NAME="$APP-$NEXT"

# 무중단 배포 전·첫 시도 때 쓰던 이름 (blogville = 8400 직접, blogville-blue = 8401)
for old in blogville-blue blogville-green; do ours "$old" && "${DOCKER[@]}" rm -f "$old" >/dev/null 2>&1 || true; done

# 띄울 포트를 다른 프로그램이 쓰고 있으면 멈춘다
if ! ours "$NEXT_NAME" && (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -qE "[:.]$NEXT_PORT\b"; then
  echo "$NEXT_PORT 포트를 이미 다른 프로그램이 쓰고 있어요. 지금 서비스는 그대로예요." >&2
  exit 1
fi

# compose가 읽는 .env: 포트(deploy.env) + 색마다 띄울 이미지. 쉬는 색 이미지만 바꾸고 서비스 중인 색은 그대로 적는다
img_of() { "${DOCKER[@]}" inspect -f '{{.Config.Image}}' "$APP-$1" 2>/dev/null || echo "$REPO:none"; }
if [ "$NEXT" = blue ]; then BLUE_IMAGE=$IMAGE; GREEN_IMAGE=$(img_of green); else GREEN_IMAGE=$IMAGE; BLUE_IMAGE=$(img_of blue); fi
{ cat "$DEPLOY_DIR/deploy.env"; printf 'BLUE_IMAGE=%s\nGREEN_IMAGE=%s\n' "$BLUE_IMAGE" "$GREEN_IMAGE"; } > "$DEPLOY_DIR/.env.tmp"
mv -f "$DEPLOY_DIR/.env.tmp" "$DEPLOY_DIR/.env"

echo "새 버전을 $NEXT($NEXT_PORT)에 띄워요 (지금 서비스: ${ACTIVE:-없음})"
# compose 전에 docker run으로 만든 같은 이름의 컨테이너가 있으면 지운다 (쉬고 있는 색이라 서비스와 상관없음)
ours "$NEXT_NAME" && "${DOCKER[@]}" rm -f "$NEXT_NAME" >/dev/null 2>&1 || true
compose up -d --no-deps --force-recreate "$NEXT"

# 마이그레이션을 마치고 새 버전이 뜰 때까지 기다린다 (최대 2분)
ready=""
for _ in $(seq 1 60); do
  running "$NEXT_NAME" || break
  if probe "$NEXT_NAME" "$NEXT_PORT"; then
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

# 관리자 계정 (AUTH-08). 시크릿이 있을 때만, 새 버전 컨테이너 안에서 scripts/create-admin.ts를 돌린다
if [ -n "${ADMIN_USERNAME:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "관리자 계정 확인"
  if ! "${DOCKER[@]}" exec -e ADMIN_USERNAME="$ADMIN_USERNAME" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" "$NEXT_NAME" npx tsx scripts/create-admin.ts; then
    echo "관리자 계정을 만들지 못했어요(위 문구 확인). 배포는 계속해요." >&2
  fi
fi

# 릴리스 노트는 아래 막대의 [🆕 업데이트 소식](/updates)에서 보여 준다 (v1.2.0부터 공지 블로그에는 올리지 않음).
# 공지 블로그에도 올리고 싶으면 서버에서 직접: docker exec <컨테이너> npx tsx scripts/publish-release-notes.ts

# 트래픽 전환: nginx가 새 버전으로 보내게 한다 (처음이면 nginx를 띄운다)
echo "트래픽을 $NEXT($NEXT_PORT)로 넘겨요"
if ! switch_traffic "$NEXT_PORT"; then
  echo "트래픽을 넘기지 못했어요. 새 버전($NEXT)은 멈춰요." >&2
  "${DOCKER[@]}" rm -f "$NEXT_NAME" >/dev/null 2>&1 || true
  exit 1
fi

# nginx를 거쳐 새 버전이 답하는지 확인한다
ok=""
for _ in $(seq 1 15); do
  if probe "$NEXT_NAME" "$PORT" "$NEXT_PORT"; then ok=1; break; fi
  sleep 1
done
if [ -z "$ok" ]; then
  echo "nginx($PORT)를 거쳐 새 버전이 답하지 않아요. nginx 로그:" >&2
  "${DOCKER[@]}" logs --tail 30 "$NGINX" >&2 || true
  if [ -n "$ACTIVE" ] && running "$APP-$ACTIVE"; then
    echo "이전 버전($ACTIVE)으로 되돌려요" >&2
    switch_traffic "$(color_port "$ACTIVE")" || true
  fi
  exit 1
fi
echo "$NEXT" > "$DEPLOY_DIR/state/active"
echo "배포 완료: $APP_URL ($NEXT, 포트 $NEXT_PORT)"

# 이전 색은 하던 요청을 마칠 시간을 주고 멈춘다. 지우지 않고 멈춰 두어서 rollback.sh로 바로 되돌릴 수 있다
if [ -n "$ACTIVE" ] && [ "$ACTIVE" != "$NEXT" ]; then
  sleep "$DRAIN_SECONDS"
  "${DOCKER[@]}" update --restart no "$APP-$ACTIVE" >/dev/null 2>&1 || true
  "${DOCKER[@]}" stop -t 20 "$APP-$ACTIVE" >/dev/null 2>&1 || true
  echo "이전 버전($ACTIVE)은 멈춰 두었어요 (되돌리기: Actions → rollback)"
fi

rm -f "$TAR"
# 우리 이미지($REPO) 중 우리 컨테이너(멈춘 이전 버전 포함)가 쓰지 않는 것은 지운다
# 멈춰 둔 이전 버전(되돌리기용)의 이미지도 남긴다
in_use=$("${DOCKER[@]}" ps -a --filter "name=$APP-" --format '{{.Image}}' | sort -u)
"${DOCKER[@]}" images "$REPO" --format '{{.Repository}}:{{.Tag}}' | grep -vxF "$in_use" | xargs -r "${DOCKER[@]}" rmi >/dev/null 2>&1 || true
