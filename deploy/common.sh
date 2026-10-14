# run.sh·rollback.sh가 같이 쓰는 함수 (source로 불러 쓴다). 서버의 ~/blogville/에 함께 올라간다.
# 쓰기 전에 DEPLOY_DIR를 정해 둔다.

APP=bv8400
REPO=$APP-blogville   # 앱 이미지 이름 (deploy.yml과 같게)
NGINX=$APP-nginx
OLD_PROXY=$APP-proxy  # nginx로 바꾸기 전에 쓰던 node 프록시 (scripts/proxy.mjs)

# 포트·이름 (deploy.env → 서버의 .env). 없으면 기본값
if [ -f "$DEPLOY_DIR/deploy.env" ]; then set -a; . "$DEPLOY_DIR/deploy.env"; set +a; fi
PROXY_PORT=${PROXY_PORT:-8400}
BLUE_PORT=${BLUE_PORT:-8401}
GREEN_PORT=${GREEN_PORT:-8402}
NGINX_IMAGE=${NGINX_IMAGE:-nginx:1.27-alpine}
DRAIN_SECONDS=${DRAIN_SECONDS:-15}

# docker 권한이 없으면 sudo(비밀번호 없이)로 쓴다
SUDO=()
if ! docker info >/dev/null 2>&1; then
  if sudo -n docker info >/dev/null 2>&1; then
    SUDO=(sudo -n)
  else
    echo "docker를 쓸 수 없어요. 서버에 docker를 설치하고 이 계정을 docker 그룹에 넣어 주세요." >&2
    exit 1
  fi
fi
DOCKER=("${SUDO[@]}" docker)

# docker compose: 서버에 있는 것(플러그인)을 먼저 쓰고, 없으면 배포 때 함께 올린 파일(bin/docker-compose)을 쓴다
if "${DOCKER[@]}" compose version >/dev/null 2>&1; then
  COMPOSE_BIN=("${DOCKER[@]}" compose)
elif [ -x "$DEPLOY_DIR/bin/docker-compose" ] || { [ -f "$DEPLOY_DIR/bin/docker-compose.gz" ] && gunzip -c "$DEPLOY_DIR/bin/docker-compose.gz" > "$DEPLOY_DIR/bin/docker-compose" && chmod +x "$DEPLOY_DIR/bin/docker-compose"; }; then
  COMPOSE_BIN=("${SUDO[@]}" "$DEPLOY_DIR/bin/docker-compose")
else
  echo "docker compose를 찾지 못했어요." >&2
  exit 1
fi
compose() {
  "${COMPOSE_BIN[@]}" -p "$APP" --project-directory "$DEPLOY_DIR" -f "$DEPLOY_DIR/compose.yml" --env-file "$DEPLOY_DIR/.env" "$@"
}

color_port() { if [ "$1" = blue ]; then echo "$BLUE_PORT"; else echo "$GREEN_PORT"; fi; }

running() { [ "$("${DOCKER[@]}" inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }

# 우리가 만든 컨테이너인지 확인한 뒤에만 지운다 (다른 사람 컨테이너는 건드리지 않음)
ours() {
  [ "$("${DOCKER[@]}" inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$1" 2>/dev/null)" = "$APP" ] && return 0
  case "$("${DOCKER[@]}" inspect -f '{{.Config.Image}}' "$1" 2>/dev/null)" in blogville:*|"$REPO":*) return 0 ;; *) return 1 ;; esac
}

# 컨테이너 안에서 포트에 요청을 보내 응답(500 미만)을 확인한다. 셋째 값이 있으면 nginx가 그 포트로 보냈는지도 본다
probe() { # 컨테이너 포트 [nginx가 보내야 할 앱 포트]
  "${DOCKER[@]}" exec "$1" node -e "
fetch('http://127.0.0.1:$2/', { redirect: 'manual' })
  .then((r) => process.exit(r.status < 500 && (!'${3:-}' || r.headers.get('x-bv8400-upstream') === '127.0.0.1:${3:-}') ? 0 : 1))
  .catch(() => process.exit(1))" 2>/dev/null
}

# nginx가 요청을 보낼 앱 포트를 바꾼다(트래픽 전환).
# nginx가 떠 있으면 설정을 확인(nginx -t)한 뒤 reload: 새 요청부터 새 쪽으로 가고, 하던 요청은 원래 쪽에서 끝난다.
# nginx가 아직 없으면(처음, 또는 node 프록시에서 바꾸는 첫 배포) compose로 띄운다.
switch_traffic() { # 앱 포트
  local dir="$DEPLOY_DIR/nginx/conf.d" f
  mkdir -p "$dir"
  for f in blogville.conf upstream.conf; do [ -f "$dir/$f" ] && cp -f "$dir/$f" "$dir/$f.bak"; done
  if [ -f "$DEPLOY_DIR/nginx/blogville.conf.template" ]; then
    sed "s/\${PROXY_PORT}/$PROXY_PORT/g" "$DEPLOY_DIR/nginx/blogville.conf.template" > "$dir/blogville.conf.tmp"
    mv -f "$dir/blogville.conf.tmp" "$dir/blogville.conf"
  fi
  printf '# run.sh·rollback.sh가 고친다. 지금 서비스 중인 앱\nupstream bv8400_app {\n    server 127.0.0.1:%s;\n    keepalive 32;\n}\n' "$1" > "$dir/upstream.conf.tmp"
  mv -f "$dir/upstream.conf.tmp" "$dir/upstream.conf"
  chmod 644 "$dir"/*.conf

  if running "$NGINX"; then
    if ! "${DOCKER[@]}" exec "$NGINX" nginx -t >/dev/null 2>&1; then
      "${DOCKER[@]}" exec "$NGINX" nginx -t >&2 || true
      for f in blogville.conf upstream.conf; do [ -f "$dir/$f.bak" ] && mv -f "$dir/$f.bak" "$dir/$f"; done
      echo "nginx 설정에 문제가 있어 바꾸지 않았어요. 지금 서비스는 그대로예요." >&2
      return 1
    fi
    "${DOCKER[@]}" exec "$NGINX" nginx -s reload >/dev/null 2>&1
  else
    # nginx 이미지가 없으면 받는다 (보통은 배포 때 앱 이미지와 함께 올라와 있다). 못 받으면 아무것도 바꾸지 않는다
    if ! "${DOCKER[@]}" image inspect "$NGINX_IMAGE" >/dev/null 2>&1 && ! "${DOCKER[@]}" pull -q "$NGINX_IMAGE" >/dev/null; then
      echo "nginx 이미지($NGINX_IMAGE)를 찾지 못했어요. 지금 서비스는 그대로예요." >&2
      return 1
    fi
    ours "$NGINX" && "${DOCKER[@]}" rm -f "$NGINX" >/dev/null 2>&1 || true
    # node 프록시(무중단 배포 첫 판)가 8400을 쓰고 있으면 이번 한 번만 바꾸며 1~2초 끊긴다.
    # 지우지 않고 멈춰 두었다가 nginx가 안 뜨면 다시 켠다
    local old_proxy=""
    if running "$OLD_PROXY" && ours "$OLD_PROXY"; then
      echo "node 프록시($OLD_PROXY)를 nginx로 바꿔요 (이번 한 번 1~2초 끊겨요)"
      "${DOCKER[@]}" update --restart no "$OLD_PROXY" >/dev/null
      "${DOCKER[@]}" stop -t 5 "$OLD_PROXY" >/dev/null
      old_proxy=1
    fi
    if ! compose up -d --no-deps nginx; then
      if [ -n "$old_proxy" ]; then
        echo "nginx가 뜨지 않아 node 프록시를 다시 켜요" >&2
        "${DOCKER[@]}" start "$OLD_PROXY" >/dev/null && "${DOCKER[@]}" update --restart unless-stopped "$OLD_PROXY" >/dev/null || true
      fi
      return 1
    fi
    [ -n "$old_proxy" ] && "${DOCKER[@]}" rm -f "$OLD_PROXY" >/dev/null 2>&1 || true
  fi
  # nginx 정의(이미지 등)가 바뀌었을 때만 다시 만든다. 그대로면 아무것도 안 한다
  compose up -d --no-deps nginx >/dev/null 2>&1 || { compose up -d --no-deps nginx >&2; return 1; }
  rm -f "$dir"/*.bak
}
