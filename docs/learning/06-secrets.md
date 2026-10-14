# 06. GitHub Secrets로 비밀 값 다루기

## 개념

DB 비밀번호, SSH 비밀번호, OAuth 키 같은 값은 **코드에 절대 넣지 않습니다.** 공개 저장소에 한 번 올라간 값은 커밋을 지워도 이미 복사됐다고 봐야 합니다.

| 어디 | 무엇을 | 예 |
|---|---|---|
| 내 컴퓨터 | `.env.local` (git 제외) | 개발용 DB 주소, 로그인 비밀키 |
| 저장소 | `.env.example` (값 없이 이름만) | 어떤 변수가 필요한지 안내 |
| GitHub | Settings → Secrets and variables → Actions | 운영 값. 워크플로에서 `${{ secrets.이름 }}`으로만 읽힘 |
| 서버 | 배포 때 만드는 `app.env` (권한 600) | 컨테이너가 읽는 운영 환경 변수 |

GitHub 시크릿은 한 번 저장하면 화면에서 다시 볼 수 없고, 로그에 찍혀도 `***`로 가려집니다. 포크에서 온 PR에는 전달되지 않습니다. 비밀이 아닌 설정(사이트 주소 등)은 **Variables**에 둡니다.

## 우리 프로젝트에서는

워크플로가 쓰는 시크릿 이름입니다. **값은 이 문서에도, 어디에도 적지 않습니다.**

| 시크릿 | 필수 | 쓰는 곳 | 용도 |
|---|---|---|---|
| `SSH_ADDRESS`, `SSH_PORT`, `SSH_ID`, `SSH_PASSWORD` | 필수 | deploy, rollback, backup, status | 운영 서버 접속 |
| `DB_ADDRESS`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_USERNAME`, `DB_PASSWORD` | 필수 | deploy | `DATABASE_URL`을 조립해 `app.env`에 넣음 |
| `APP_URL` | 선택 | deploy | 사용자가 여는 주소. 없으면 `http://SSH_ADDRESS:8400` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | 선택 | deploy, status | 배포 때 관리자 계정·공지 블로그 생성/비밀번호 갱신 (12~64자) |
| `KAKAO_CLIENT_ID`·`_SECRET`, `NAVER_…`, `GOOGLE_…` | 선택 | deploy | 소셜 로그인. ID와 SECRET이 둘 다 있는 서비스만 켜짐 |
| `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET` | 선택 | deploy | 📰 뉴스 위젯(네이버 검색 API). 있으면 켜짐 |
| `FEEDBACK_BOT_TOKEN` | 선택 | deploy | 버그·문의 자동 처리 API 열쇠, 32자 이상이면 켜짐 |
| `MIRROR_TOKEN` | 선택 | mirror | 과제 제출 저장소에 쓰기. 없으면 복사를 건너뜀 |
| `SONAR_TOKEN` | 선택 | sonar | SonarCloud 분석. 없으면 분석을 건너뜀 ([03-sonar.md](03-sonar.md)) |

로그인 비밀키(`BETTER_AUTH_SECRET`)는 시크릿이 아니라 서버에서 처음 한 번 무작위로 만들어 `~/blogville/auth-secret`에 둡니다([deploy/run.sh](../../deploy/run.sh)). 공개해도 되는 포트 같은 값은 [deploy/deploy.env](../../deploy/deploy.env)에 그대로 커밋합니다.

로컬은 [.env.example](../../.env.example)을 `.env.local`로 복사해 채웁니다. `.gitignore`가 `.env*`(예시 파일 제외)를 막고 있습니다.

## 직접 해 보기

```bash
gh secret list                          # 이름과 바꾼 날짜만 보임 (값은 안 보임)
git check-ignore -v .env.local          # .env.local이 git에서 빠지는 규칙 확인
git log --all --name-only --format= | grep -E '(^|/)\.env' | sort -u   # 이력에 .env 파일이 올라간 적 있는지
```

해 볼 것:

1. 연습 저장소에서 `gh secret set PRACTICE_TOKEN`으로 값을 넣고, 워크플로에서 `echo "${{ secrets.PRACTICE_TOKEN }}"`를 찍어 `***`로 가려지는지 봅니다.
2. 비밀 값이 실수로 커밋됐다면: 먼저 그 값을 **바꾸고(폐기)**, 그다음 이력 정리를 생각합니다. 순서가 반대면 소용없습니다.
