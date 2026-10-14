# 11. Service Discovery

## 개념

서비스를 여러 벌 띄우거나 다시 띄우면 IP가 바뀝니다. 설정에 IP를 적어 두면 그때마다 고쳐야 하죠. **Service Discovery**는 "이름 → 지금 살아 있는 주소들"을 알려 주는 장치로, 부르는 쪽은 이름만 알면 됩니다.

| 방식 | 예 | 어떻게 |
|---|---|---|
| DNS 기반 | Docker·Kubernetes 안 DNS | 서비스 이름을 DNS로 물으면 살아 있는 컨테이너 IP들이 나옴 |
| 등록소(레지스트리) 기반 | Eureka, Consul | 서비스가 뜰 때 스스로 등록하고, 주기적으로 "살아 있음"을 알림 |

헬스 체크와 함께 씁니다. 죽은 쪽은 목록에서 빠져야 하니까요.

## 우리 프로젝트에서는 (MSA 실습)

도커 compose 네트워크 안의 DNS(127.0.0.11)를 씁니다.

- 앱은 `http://market:8500`, 게이트웨이는 `http://app-msa:8400`처럼 **이름**으로만 부릅니다. IP는 어디에도 적혀 있지 않습니다.
- `--scale market=2`로 띄우면 `market`이라는 이름에 컨테이너 두 개의 IP가 붙습니다.
- 게이트웨이(nginx)는 `resolver 127.0.0.11 valid=5s`로 이 이름을 5초마다 다시 묻습니다. 그래서 늘리거나 줄여도 게이트웨이를 다시 띄울 필요가 없습니다.
- `market` 이미지에는 `HEALTHCHECK`(`/health`)가 있고, 앱은 `depends_on: condition: service_healthy`로 market이 건강해진 뒤에 뜹니다.

## 직접 해 보기

```bash
docker compose --profile msa up -d --build --scale market=2
docker compose exec gateway nslookup market 127.0.0.11       # IP 두 개
for i in 1 2 3 4; do curl -s -D - localhost:8080/market/health -o /dev/null | grep -i x-served-by; done
#  X-Served-By가 두 컨테이너 이름으로 번갈아 나옴

docker compose --profile msa up -d --scale market=3           # 늘리기
sleep 6; docker compose exec gateway nslookup market 127.0.0.11   # IP 세 개, 게이트웨이는 그대로
```

해 볼 것: `docker compose ps`로 `(healthy)` 표시를 보고, 한 컨테이너를 `docker stop`한 뒤 몇 초 안에 요청이 남은 쪽으로만 가는지 확인합니다. Eureka·Consul 같은 등록소 방식은 무엇이 더 필요할지(등록·해제, 하트비트) 비교해 봅니다.
