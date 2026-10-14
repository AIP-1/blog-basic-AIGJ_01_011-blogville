# 09. MSA로 서비스 나누기

## 개념

**모놀리스**는 기능 전부가 한 프로그램(한 배포 단위)에 들어 있는 구조이고, **MSA(마이크로서비스 아키텍처)**는 기능을 작은 서비스 여러 개로 나눠 따로 만들고, 따로 배포하고, 따로 늘리는 구조입니다.

| | 모놀리스 | MSA |
|---|---|---|
| 배포 | 한 번에 전부 | 서비스마다 따로 |
| 늘리기(스케일) | 앱 전체를 여러 벌 | 바쁜 서비스만 여러 벌 |
| 장애 | 한 곳이 느리면 전체가 느려질 수 있음 | 한 서비스가 죽어도 나머지는 돌게 만들 수 있음 |
| 비용 | 단순함 | 서비스 사이 통신·배포·관찰이 복잡해짐 |

그래서 처음부터 다 나누지 않고, **경계가 분명하고 성격이 다른 부분부터** 떼어 내는 것이 보통입니다. 잘 떼어지는 후보는 "자기 데이터가 따로 있거나, 바깥 시스템과 이야기하거나, 부하 모양이 다른" 부분입니다.

## 우리 프로젝트에서는

Blogville은 Next.js 앱 하나(모놀리스)입니다. 지금 규모에서는 이게 맞는 선택이라 운영은 그대로 두고, **실습용으로 한 서비스를 떼어 낸 구성**을 로컬 도커에 만들었습니다.

떼어 낸 것: **시세·날씨 서비스** ([services/market/](../../services/market/))

- 📈 증시 위젯은 네이버 증권, ☀️ 날씨 위젯은 Open-Meteo를 부릅니다. 바깥 시스템과 이야기하는 부분이라 경계가 분명하고, 1.5초마다 묻는 실시간 시세처럼 부하 모양도 블로그 글 읽기와 다릅니다.
- 이 서비스는 정해진 바깥 주소만 대신 받아 주고(아무 주소나 받아 주는 길이 되지 않게), 같은 요청은 잠깐 기억해(시세 1초, 차트·검색 1분, 날씨 30분) 앱이 여러 벌이어도 바깥에는 한 번만 묻습니다.
- **앱 코드는 한 줄도 바꾸지 않았습니다.** 앱에는 원래 시험용으로 바깥 주소를 바꾸는 환경 변수(`STOCK_QUOTE_BASE` 등)가 있어서, 그 값을 `http://market:8500/...`로 주기만 하면 앱이 서비스를 거쳐 갑니다. 환경 변수를 빼면 예전처럼 직접 부릅니다(운영이 지금 이 상태).

```
브라우저 ─▶ gateway :8080 ─┬─▶ app-msa :8400 (블로그) ─▶ db :5432
                           │        │
                           │        └─▶ market :8500 (×2) ─▶ 네이버 증권 / Open-Meteo
                           └─▶ /market/health
```

| 서비스 | 파일 | 하는 일 |
|---|---|---|
| `gateway` | [services/gateway/nginx.conf](../../services/gateway/nginx.conf) | 바깥 문 하나. 경로를 보고 나눠 보냄 ([10-api-gateway.md](10-api-gateway.md)) |
| `app-msa` | 저장소의 Dockerfile | 블로그 앱. 포트를 바깥에 열지 않음 |
| `market` | [services/market/](../../services/market/) | 시세·날씨 서비스. 외부 패키지 없는 Node 파일 두 개 |
| `db` | postgres:16 | 블로그 DB |

## 직접 해 보기

```bash
docker compose --profile msa up --build --scale market=2     # 처음엔 몇 분. http://localhost:8080
docker compose exec app-msa npm run db:seed                   # 예시 회원 demo / demo1234

curl localhost:8080/gateway/health                            # 게이트웨이
curl -i localhost:8080/market/health                          # 시세·날씨 서비스 (X-Served-By: 답한 컨테이너)
docker compose logs -f gateway                                # 요청마다 "→ 어느 컨테이너로" 보임
```

해 볼 것:

1. `http://localhost:8080/@demo`에서 위젯 설정으로 📈 관심 종목을 넣고, `curl localhost:8080/market/health`의 `upstream`·`hits` 숫자가 느는지 봅니다.
2. `docker compose stop market`으로 서비스를 멈추면 블로그는 그대로 뜨고 증시·날씨 위젯만 "못 받았어요"가 되는지 봅니다(장애가 번지지 않음). `docker compose start market`으로 되돌립니다.
3. `docker compose --profile msa up -d --scale market=3`으로 늘리고 [11-service-discovery.md](11-service-discovery.md)를 읽습니다.
4. 생각해 볼 것: 다음으로 떼어 낸다면 무엇이 좋을까요? (예: 알림, 첨부 파일 이미지 처리, 마을 게임) 각자 쓰는 표가 다른 서비스와 얽혀 있는지 `src/db/schema.ts`에서 확인해 봅니다.
