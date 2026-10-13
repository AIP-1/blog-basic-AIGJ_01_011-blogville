#!/usr/bin/env bash
# DB 백업 (Actions → backup, 매일 새벽 3시 KST 자동). ~/blogville/backups/<날짜시각>/ 에 표마다 JSON 줄(.jsonl.gz), 최근 14개만 남긴다.
# 지금 서비스 중인 앱 이미지로 일회용 컨테이너를 띄워 scripts/backup.mjs를 돌린다 (app.env의 DATABASE_URL 사용).
set -euo pipefail

APP=bv8400
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/blogville}"
KEEP=14

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if sudo -n docker info >/dev/null 2>&1; then DOCKER=(sudo -n docker); else echo "docker를 쓸 수 없어요." >&2; exit 1; fi
fi

ACTIVE=$(cat "$DEPLOY_DIR/state/active" 2>/dev/null || true)
[ -n "$ACTIVE" ] || { echo "서비스 중인 버전을 알 수 없어요 (state/active 없음)." >&2; exit 1; }
IMAGE=$("${DOCKER[@]}" inspect -f '{{.Config.Image}}' "$APP-$ACTIVE")

STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEPLOY_DIR/backups/$STAMP"
# 컨테이너는 node(1000) 계정으로 쓴다
chmod 777 "$DEPLOY_DIR/backups/$STAMP"
"${DOCKER[@]}" run --rm --network host --env-file "$DEPLOY_DIR/app.env" \
  -e BACKUP_DIR=/backup -v "$DEPLOY_DIR/backups/$STAMP:/backup" \
  "$IMAGE" node scripts/backup.mjs
chmod 700 "$DEPLOY_DIR/backups/$STAMP"
chmod 700 "$DEPLOY_DIR/backups"
echo "저장: $DEPLOY_DIR/backups/$STAMP ($(du -sh "$DEPLOY_DIR/backups/$STAMP" | cut -f1))"

# 오래된 백업 정리 (최근 KEEP개만)
ls -1d "$DEPLOY_DIR"/backups/*/ 2>/dev/null | sort | head -n -"$KEEP" | xargs -r rm -rf
echo "남은 백업: $(ls -1d "$DEPLOY_DIR"/backups/*/ | wc -l)개"
