#!/usr/bin/env bash
# 바로 전 버전으로 되돌린다 (Actions → rollback → Run workflow).
# run.sh는 새 버전으로 넘긴 뒤 이전 색(blue/green) 컨테이너를 지우지 않고 멈춰 둔다.
# 그 컨테이너를 다시 켜서 응답을 확인한 뒤 프록시가 그쪽으로 넘기게 하고, 지금 버전은 멈춰 둔다.
# 한 번 더 돌리면 다시 원래 버전으로 돌아온다. DB 마이그레이션은 되돌리지 않는다(새 열·표만 더하는 방식이라 옛 버전도 돈다).
set -euo pipefail

APP=bv8400
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/blogville}"
DRAIN=15

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if sudo -n docker info >/dev/null 2>&1; then DOCKER=(sudo -n docker); else echo "docker를 쓸 수 없어요." >&2; exit 1; fi
fi

ACTIVE=$(cat "$DEPLOY_DIR/state/active" 2>/dev/null || true)
case "$ACTIVE" in
  blue) PREV=green; PREV_PORT=8402 ;;
  green) PREV=blue; PREV_PORT=8401 ;;
  *) echo "지금 서비스 중인 버전을 알 수 없어요 (state/active 없음)." >&2; exit 1 ;;
esac
PREV_NAME="$APP-$PREV"

if ! "${DOCKER[@]}" inspect "$PREV_NAME" >/dev/null 2>&1; then
  echo "되돌릴 이전 버전($PREV_NAME)이 없어요. 이전 배포가 이 기능 전에 이뤄졌다면 다음 배포부터 되돌릴 수 있어요." >&2
  exit 1
fi
echo "이전 버전: $PREV_NAME ($("${DOCKER[@]}" inspect -f '{{.Config.Image}}' "$PREV_NAME"))"

"${DOCKER[@]}" start "$PREV_NAME" >/dev/null
"${DOCKER[@]}" update --restart unless-stopped "$PREV_NAME" >/dev/null

ready=""
for _ in $(seq 1 60); do
  if "${DOCKER[@]}" exec "$PREV_NAME" node -e "fetch('http://127.0.0.1:$PREV_PORT/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "이전 버전이 응답하지 않아 되돌리지 않았어요. 지금 서비스($ACTIVE)는 그대로예요. 로그:" >&2
  "${DOCKER[@]}" logs --tail 40 "$PREV_NAME" >&2 || true
  "${DOCKER[@]}" update --restart no "$PREV_NAME" >/dev/null 2>&1 || true
  "${DOCKER[@]}" stop "$PREV_NAME" >/dev/null 2>&1 || true
  exit 1
fi

printf '%s\n' "$PREV_PORT" > "$DEPLOY_DIR/state/active-port.tmp"
mv -f "$DEPLOY_DIR/state/active-port.tmp" "$DEPLOY_DIR/state/active-port"
chmod 644 "$DEPLOY_DIR/state/active-port"
echo "$PREV" > "$DEPLOY_DIR/state/active"
echo "되돌렸어요: 지금 서비스는 $PREV(포트 $PREV_PORT)"

sleep "$DRAIN"
"${DOCKER[@]}" update --restart no "$APP-$ACTIVE" >/dev/null 2>&1 || true
"${DOCKER[@]}" stop -t 20 "$APP-$ACTIVE" >/dev/null 2>&1 || true
echo "방금까지의 버전($ACTIVE)은 멈춰 두었어요 (다시 rollback을 돌리면 그 버전으로 돌아가요)"
