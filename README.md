# Blogville

티스토리 같은 블로그 서비스 **Blogville**의 문서와 코드 저장소입니다. [GitHub Spec Kit](https://github.com/github/spec-kit) 흐름으로 만듭니다.

| 경로 | 내용 |
|---|---|
| `docs/01-requirements.md` | 요구사항 명세서 (v1.44) |
| `.specify/memory/constitution.md` | 프로젝트 원칙 |
| `specs/001-blog-core/` | 첫 기능(가입·블로그·글·카테고리)의 spec·plan·tasks |
| `specs/002-attachments/` | 사진·파일 첨부의 spec·plan·tasks |
| `specs/003-tags/` | 태그의 spec·plan·tasks |
| `specs/004-comments/` | 댓글·답글의 spec·plan·tasks |
| `specs/005-blog-sidebar/` | 블로그 옆 칸·조회수·방문자의 spec·plan·tasks |
| `specs/006-post-manager/` | 글 관리·주인 도구 막대의 spec·plan·tasks |
| `specs/007-likes/` | 공감(♥)의 spec·plan·tasks |
| `specs/008-neighbors/` | 이웃·이웃 새 글·마을 소식의 spec·plan·tasks |
| `specs/009-drafts/` | 임시 저장의 spec·plan·tasks |
| `specs/011-withdraw/` | 회원 탈퇴의 spec·plan·tasks |
| `specs/012-admin/` | 관리자의 spec·plan·tasks |
| `specs/013-town-search/` | 마을 검색의 spec·plan·tasks |
| `specs/014-paste-reupload/` | 내 다른 글 첨부 붙여 넣기의 spec·plan·tasks |
| `specs/015-settings-visits-password/` | 방문자 그래프·카테고리 글 수·비밀번호 바꾸기의 spec·plan·tasks |
| `specs/016-post-nav/` | 이전 글·다음 글과 블로그 이름 링크의 spec·plan·tasks |
| `specs/017-notifications/` | 알림함(🔔)의 spec·plan·tasks |
| `specs/018-neighbor-list/` | 내 이웃 목록·이웃 취소의 spec·plan·tasks |
| `specs/019-editor-toolbar/` | 에디터 도구 모음 정리의 spec·plan·tasks |
| `specs/020-error-retry/` | 오류 화면 [다시 시도]·루트 오류 화면의 spec·plan·tasks |
| `specs/021-login-next/` | 로그인 뒤 보던 글로 돌아오기의 spec·plan·tasks |
| `specs/022-publish-notice/` | 새 글 발행 안내의 spec·plan·tasks |
| `specs/023-admin-post-delete/` | 관리자 글 화면 삭제·공지 블로그 주소의 spec·plan·tasks |
| `specs/024-comment-manage/` | 댓글 관리의 spec·plan·tasks |
| `specs/025-blog-browse/` | 마을 소식 블로그 둘러보기의 spec·plan·tasks |
| `specs/026-favorite-neighbors/` | 즐겨찾는 이웃 ⭐(내 이웃 목록, 이웃 새 글 맨 위)의 spec·plan·tasks |
| `specs/027-session-keep/` | 로그인 유지 7일 연장(SessionKeeper)·만료 세션과 로그인 실패 기록 정리의 spec·plan·tasks |
| `specs/028-char-count/` | 글쓰기 아래 실시간 글자 수 `N자`의 spec·plan·tasks |
| `specs/029-admin-password-reset/` | 관리자 회원 찾기·비밀번호 초기화의 spec·plan·tasks |
| `specs/030-profile-photo/` | 👤 내 정보 프로필 사진 올리기·지우기, 블로그 홈 머리글 사진의 spec·plan·tasks |
| `specs/031-points-levels/` | 경험치·레벨·코인 원장, 글·댓글·공감 보상, 헤더 Lv·🪙, 📒 내역 화면의 spec·plan·tasks |
| `specs/032-pixel-characters/` | 가입 때 도트 캐릭터 고르기, 헤더·블로그 홈 캐릭터의 spec·plan·tasks |
| `specs/033-attendance/` | 자동 출석·7일 보상표·📮 출석 체크 화면의 spec·plan·tasks |
| `specs/034-level-up/` | 레벨업 알림·가운데 팝업·알림함 레벨업 줄의 spec·plan·tasks |
| `specs/035-shop/` | 마을 상점(아바타·가구·배경 도트 아이템, 정렬, 사기)의 spec·plan·tasks |
| `specs/036-closet/` | 꾸미기(배경 걸기·모자·옷·소품 입기, 블로그 미니룸)의 spec·plan·tasks |
| `specs/037-house/` | 우리 집(집 단계, 블로그 홈 가구 칸에 놓기·옮기기·비우기)의 spec·plan·tasks |
| `src/` | Next.js 16 앱 |

## 실행

Node.js 22, PostgreSQL 16이 필요합니다.

```bash
cp .env.example .env.local     # BETTER_AUTH_SECRET은 긴 무작위 값으로 바꾼다
docker compose up -d db        # 또는 로컬 PostgreSQL에 blogville DB를 만든다
npm install
npm run db:migrate
npm run db:seed                # (선택) demo / demo1234, /@demo
npm run admin:create           # (선택) .env.local의 ADMIN_USERNAME·ADMIN_PASSWORD로 관리자와 /@notice
npm run dev                    # http://localhost:3000
```

## 확인

```bash
npm run typecheck
npm run lint
npm test                       # Vitest 단위 테스트
npm run test:e2e               # Playwright E2E (개발 서버를 띄우거나 자동으로 띄운다)
npm run test:perf              # 글 1,000개 블로그 홈 응답 시간 (서버를 먼저 띄운다, 기준 1초)
```

미리 설치된 Chromium을 쓰려면 `PW_CHROMIUM_PATH=/경로/chrome npm run test:e2e`.
E2E는 `.env.local`의 DB에 고유한 아이디로 회원을 만들어 시험합니다.

## 첨부 파일

올린 사진·파일은 `storage/uploads/`(git 제외, `UPLOAD_DIR`로 바꿈)에 저장됩니다.
어느 글에도 붙지 않은 지 하루 지난 첨부는 정리 작업이 지웁니다. 같은 작업이 어제보다 오래된 조회 기록, 만료된 로그인 세션, 하루 넘게 지난 로그인 실패 기록(잠금 중인 것은 남김)도 지웁니다. 자동 실행 설정은 없어서 하루에 한 번 손으로 돌립니다.

```bash
npm run posts:cleanup -- --dry-run   # 지울 개수만
npm run posts:cleanup
```
