# Blogville

티스토리 같은 블로그 서비스 **Blogville**의 문서와 코드 저장소입니다. [GitHub Spec Kit](https://github.com/github/spec-kit) 흐름으로 만듭니다.

| 경로 | 내용 |
|---|---|
| `docs/01-requirements.md` | 요구사항 명세서 (v1.26) |
| `.specify/memory/constitution.md` | 프로젝트 원칙 |
| `specs/001-blog-core/` | 첫 기능(가입·블로그·글·카테고리)의 spec·plan·tasks |
| `src/` | Next.js 16 앱 |

## 실행

Node.js 22, PostgreSQL 16이 필요합니다.

```bash
cp .env.example .env.local     # BETTER_AUTH_SECRET은 긴 무작위 값으로 바꾼다
docker compose up -d db        # 또는 로컬 PostgreSQL에 blogville DB를 만든다
npm install
npm run db:migrate
npm run db:seed                # (선택) demo / demo1234, /@demo
npm run dev                    # http://localhost:3000
```

## 확인

```bash
npm run typecheck
npm run lint
npm test                       # Vitest 단위 테스트
npm run test:e2e               # Playwright E2E (개발 서버를 띄우거나 자동으로 띄운다)
```

미리 설치된 Chromium을 쓰려면 `PW_CHROMIUM_PATH=/경로/chrome npm run test:e2e`.
E2E는 `.env.local`의 DB에 고유한 아이디로 회원을 만들어 시험합니다.
