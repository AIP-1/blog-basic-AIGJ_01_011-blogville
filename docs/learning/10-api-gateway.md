# 10. API Gateway

## 개념

서비스가 여러 개가 되면 브라우저가 서비스마다 주소를 알아야 하고, 로그인 확인·요청 기록·속도 제한 같은 공통 일을 서비스마다 해야 합니다. **API Gateway**는 바깥에 문을 하나만 두고, 들어온 요청의 경로를 보고 뒤의 알맞은 서비스로 보내는 앞단입니다.

자주 맡기는 일:

- **라우팅**: `/api/orders/**` → 주문 서비스, 나머지 → 웹
- **공통 처리**: 인증 확인, 요청 기록, 속도 제한, CORS, 압축
- **숨기기**: 뒤의 서비스는 바깥에 포트를 열지 않음

대표 도구: nginx, Spring Cloud Gateway, Kong, AWS API Gateway.

## 우리 프로젝트에서는

- **운영**: 이미 nginx가 앞단에 있습니다([deploy/nginx/](../../deploy/nginx/), [08-zero-downtime.md](08-zero-downtime.md)). 지금은 블루·그린 중 한쪽으로 보내는 일만 합니다.
- **MSA 실습**: [services/gateway/nginx.conf](../../services/gateway/nginx.conf)가 게이트웨이입니다.

| 경로 | 보내는 곳 | 비고 |
|---|---|---|
| `/gateway/health` | 게이트웨이 자신 | `{"status":"UP"}` |
| `/market/health` | `market:8500/health` | 시세·날씨 서비스는 상태 확인만 바깥에 엶 |
| `/` (나머지 전부) | `app-msa:8400` | 증시 실시간(SSE)이 끊기지 않게 `proxy_buffering off` |

- 모든 응답에 `X-Gateway: blogville-gateway` 머리를 붙이고, 요청마다 "어느 컨테이너로 갔는지(`$upstream_addr`)"를 로그에 남깁니다.
- 앱(`app-msa`)과 `market`은 `ports`가 없어 바깥에서 바로 닿지 않습니다. 오직 게이트웨이를 거칩니다.

## 직접 해 보기

```bash
docker compose --profile msa up -d --build
curl -i localhost:8080/ | grep -i x-gateway
curl localhost:8400/      # 실패해야 정상: 앱은 바깥에 포트가 없음
docker compose logs gateway | tail
```

해 볼 것: `nginx.conf`에 `location /api/stocks/ { limit_req ...; }`로 속도 제한을 걸어 보고, `docker compose restart gateway` 뒤 빠르게 여러 번 불러 503(또는 429)이 나오는지 봅니다.
