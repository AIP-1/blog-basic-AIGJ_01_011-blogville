# 04. Docker로 실행해 보기

## 개념

Docker는 앱과 앱이 도는 데 필요한 것(OS 파일, Node, 라이브러리)을 **이미지** 하나로 묶고, 그 이미지를 어디서나 같은 모양의 **컨테이너**로 띄우게 해 줍니다. "내 컴퓨터에서는 되는데"를 없애는 도구입니다.

| 용어 | 뜻 |
|---|---|
| Dockerfile | 이미지를 만드는 순서를 적은 파일 |
| 이미지 | 만든 결과물(읽기 전용). 태그로 버전을 구분 (`bv8400-blogville:1a2b3c4`) |
| 컨테이너 | 이미지를 실제로 띄운 것. 지우면 안의 변경은 사라짐 |
| 볼륨 | 컨테이너가 지워져도 남겨야 할 데이터(DB 파일, 올린 사진)를 바깥에 두는 곳 |
| 멀티 스테이지 빌드 | 빌드용 단계와 실행용 단계를 나눠, 필요한 결과만 다음 단계로 복사 |
| docker compose | 컨테이너 여러 개(앱 + DB 등)를 YAML 하나로 함께 띄우는 도구 |

## 우리 프로젝트에서는

[Dockerfile](../../Dockerfile)은 두 단계입니다.

| 단계 | 줄 | 하는 일 |
|---|---|---|
| `build` | `FROM node:22-alpine AS build` | 작은 Alpine 리눅스 + Node 22에서 시작 |
| | `COPY package.json package-lock.json ./` → `RUN npm ci` | 의존성 파일만 먼저 복사해 설치. 소스가 바뀌어도 의존성이 그대로면 이 층은 캐시를 다시 씁니다 |
| | `COPY . .` → `RUN npm run build` | 소스를 복사하고 `next build` |
| 실행 | `FROM node:22-alpine` | 새 빈 이미지에서 다시 시작 |
| | `ENV NODE_ENV=production PORT=8400 ...` | 운영 환경 변수 |
| | `COPY --from=build /app ./` | 빌드 단계 결과를 가져옴. 마이그레이션(drizzle-kit)과 정리 작업(tsx)도 컨테이너에서 돌려서 `node_modules`째 가져옵니다 |
| | `USER node` | root가 아닌 계정으로 실행(보안) |
| | `HEALTHCHECK ... /api/health` | 30초마다 앱이 DB까지 닿는지 확인. `docker ps`에 `(healthy)`로 보임 |
| | `EXPOSE 8400` / `CMD ...` | 시작할 때 `scripts/migrate.mjs`로 DB를 맞춘 뒤 `next start -p 8400` |

- 이미지에 넣지 않을 파일은 [.dockerignore](../../.dockerignore)에 적습니다(`node_modules`, `.next`, `.env*` 등).
- 저장소 맨 위 [docker-compose.yml](../../docker-compose.yml)에는 서비스 여섯이 있습니다. 평소엔 `db`만 뜨고, 나머지는 **프로필**을 줄 때만 뜹니다.

  | 서비스 | 프로필 | 하는 일 |
  |---|---|---|
  | `db` | (없음) | 개발용 PostgreSQL 16, `localhost:5432`. `npm run dev`와 같이 씀 |
  | `app` | `app` | 운영과 같은 Dockerfile로 만든 앱, `localhost:8400`. DB는 서비스 이름 `db`로 찾아감(`postgres://blog:blog@db:5432/blogville`) |
  | `sonarqube` | `sonar` | 품질 검사 서버, `localhost:9000` ([03-sonar.md](03-sonar.md)) |
  | `app-msa`·`market`·`gateway` | `msa` | MSA 실습. 게이트웨이 `localhost:8080` 하나로만 들어감 ([09-msa.md](09-msa.md)) |

- `app`은 `db`의 healthcheck(`pg_isready`)가 통과한 뒤에 뜨고(`depends_on: condition: service_healthy`), 뜰 때 마이그레이션을 먼저 합니다.
- 운영 서버의 구성(nginx + 앱 두 벌)은 [deploy/compose.yml](../../deploy/compose.yml)로 따로 있습니다. [08-zero-downtime.md](08-zero-downtime.md)에서 다룹니다.

## 직접 해 보기

가장 빠른 길 (명령 하나):

```bash
docker compose --profile app up --build        # 처음엔 이미지 만드느라 몇 분. http://localhost:8400
docker compose exec app npm run db:seed        # (다른 터미널) 예시 회원 demo / demo1234, 블로그 /@demo
docker compose --profile app down              # 정리 (DB·올린 파일은 볼륨에 남음, 지우려면 down -v)
```

한 단계씩 (이미지와 컨테이너를 직접 다뤄 보기):

```bash
# 1. 개발용 DB 띄우기
docker compose up -d db
docker compose ps

# 2. 앱 이미지 만들기 (몇 분 걸림)
docker build -t blogville:local .
docker images blogville

# 3. 만든 이미지로 앱 띄우기 (맥의 도커에서 호스트 DB는 host.docker.internal)
docker run --rm -p 8400:8400 \
  -e DATABASE_URL=postgres://blog:blog@host.docker.internal:5432/blogville \
  -e BETTER_AUTH_SECRET=local-practice-secret-please-change-0000 \
  -e BETTER_AUTH_URL=http://localhost:8400 \
  blogville:local
# 브라우저에서 http://localhost:8400

# 4. 정리
docker compose down          # DB 컨테이너 멈춤 (데이터는 pgdata 볼륨에 남음)
docker rmi blogville:local
```

해 볼 것:

1. `docker history blogville:local`로 Dockerfile 줄마다 층이 생긴 것을 봅니다.
2. 소스 한 줄만 고치고 다시 `docker build` 하면 `npm ci` 층이 `CACHED`로 넘어가는지 봅니다.
3. `docker run --rm blogville:local whoami`로 `node` 계정으로 도는지 확인합니다.
