# 01. Git Flow 브랜치 전략

## 개념

Git Flow는 브랜치마다 역할을 정해 두는 방식입니다. 운영에 나가는 코드(`main`)와 개발 중인 코드(`develop`)를 나누고, 기능·배포 준비·급한 수정은 각자 짧게 사는 브랜치에서 합니다.

| 브랜치 | 수명 | 하는 일 |
|---|---|---|
| `main` | 영구 | 지금 운영 중인 코드. 여기 merge되면 배포됩니다 |
| `develop` | 영구 | 다음 배포에 들어갈 기능을 모읍니다 |
| `feature/*` | 짧음 | 기능 하나를 만들고 `develop`으로 돌아갑니다 |
| `release/*` | 짧음 | 배포 직전에 버전·문서만 다듬고 `main`과 `develop` 둘 다로 갑니다 |
| `hotfix/*` | 짧음 | 운영 버그를 `main`에서 바로 고치고 `main`과 `develop` 둘 다로 갑니다 |

핵심은 **`main`에는 사람이 직접 커밋하지 않는다**는 것입니다. 모든 변경은 PR을 거치고, PR은 CI가 초록이어야 merge됩니다.

## 우리 프로젝트에서는

규칙 전체는 저장소 맨 위 [CONTRIBUTING.md](../../CONTRIBUTING.md)에 있습니다. 요약하면:

- 기능 PR은 **항상 `develop` 대상**입니다.
- merge는 merge commit으로 합니다(squash·rebase 하지 않음). `main`·`develop`에는 force push 금지입니다.
- 배포는 `develop`에서 `release/<버전>`을 만들어 `main`으로 PR을 엽니다. 이 브랜치에서 `package.json` 버전, `docs/releases/v<버전>.md` 릴리스 노트, `CHANGELOG.md`를 고칩니다.
- `main`에 merge되면 `.github/workflows/deploy.yml`이 운영 서버에 무중단 배포하고, `release.yml`이 GitHub 릴리스와 `v<버전>` 태그를 만듭니다.
- `main`·`develop`은 브랜치 보호 규칙으로 "PR 필수 + `check` 통과 필수 + force push 금지"가 걸려 있습니다.

DB 마이그레이션이 든 기능 브랜치는 merge 직전에 최신 `develop`을 받아 `drizzle/meta/_journal.json`에서 내 마이그레이션이 맨 뒤에 오게 맞춥니다. 두 브랜치가 동시에 마이그레이션을 만들면 순서가 꼬이기 때문입니다.

## 직접 해 보기

```bash
# 1. develop에서 기능 브랜치 만들기
git switch develop
git pull origin develop
git switch -c feature/hello-learning

# 2. 고치고 로컬 검사
echo "연습" > docs/learning/practice.txt
git add docs/learning/practice.txt
git commit -m "docs: Git Flow 연습"
npm run lint && npm run typecheck && npm test

# 3. 올리고 develop 대상으로 PR 열기
git push -u origin feature/hello-learning
gh pr create --base develop --title "docs: Git Flow 연습" --body "연습용"

# 4. CI(check)가 초록이 되면 merge commit으로 합치기
gh pr checks --watch
gh pr merge --merge --delete-branch
```

확인해 볼 것:

- `git log --graph --oneline develop main | head -30`으로 release 브랜치가 `main`과 `develop` 양쪽에 합쳐진 모양을 봅니다.
- `git tag --sort=-creatordate | head`로 배포마다 붙은 `v1.x.y` 태그를 봅니다.
- 연습이 끝나면 PR을 닫고 브랜치를 지웁니다(실제로 merge하지 않아도 됩니다).
