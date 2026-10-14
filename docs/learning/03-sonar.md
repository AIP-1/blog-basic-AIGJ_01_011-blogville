# 03. 코드 품질: SonarLint · SonarQube · 품질 게이트

## 개념

| 도구 | 어디서 | 하는 일 |
|---|---|---|
| **SonarLint** (지금 이름은 SonarQube for IDE) | 내 에디터(VS Code·IntelliJ) | 코드를 쓰는 동안 버그 냄새·보안 약점·중복을 밑줄로 바로 알려 줍니다. 저장소에 아무것도 올라가지 않습니다 |
| **SonarQube** (서버) / **SonarCloud** (호스팅) | CI 뒤 | 저장소 전체를 분석해 이슈·중복률·테스트 커버리지를 대시보드로 쌓습니다 |
| **품질 게이트**(Quality Gate) | SonarQube 안 | "새 코드의 버그 0개, 커버리지 80% 이상" 같은 통과 조건. 실패하면 PR 검사가 빨갛게 되어 merge를 막습니다 |

분석 결과는 크게 세 갈래입니다.

- **Bug**: 틀리게 돌 가능성이 큰 코드
- **Vulnerability / Security Hotspot**: 보안 약점, 사람이 확인해야 할 곳
- **Code Smell**: 돌긴 하지만 읽기·고치기 어려운 코드(긴 함수, 중복 등)

품질 게이트는 보통 **새 코드(New Code)** 기준으로 겁니다. 옛 코드를 한 번에 다 고치지 않아도, 오늘 쓴 코드는 기준을 넘게 만드는 방식입니다.

## 우리 프로젝트에서는

| 파일 | 하는 일 |
|---|---|
| [sonar-project.properties](../../sonar-project.properties) | 분석할 폴더(`src`, `scripts`), 테스트 폴더, 커버리지 보고서(`coverage/lcov.info`) 위치. 화면 코드(`src/app`, `src/components`)는 E2E가 맡으므로 커버리지 계산에서 뺍니다 |
| [vitest.config.mts](../../vitest.config.mts) | `npm run test:coverage`가 `src/lib`·`src/server`의 커버리지를 재서 `coverage/lcov.info`로 남김 |
| [.github/workflows/sonar.yml](../../.github/workflows/sonar.yml) | PR과 `develop`·`main` push마다 SonarCloud 분석 + 품질 게이트(`sonar.qualitygate.wait=true`). 시크릿 `SONAR_TOKEN`이 없으면 건너뜀 |
| [docker-compose.yml](../../docker-compose.yml)의 `sonarqube` | 계정 없이 내 컴퓨터에서 SonarQube 서버를 띄워 보는 실습용 |
| [.vscode/extensions.json](../../.vscode/extensions.json)·[settings.json](../../.vscode/settings.json) | VS Code를 열면 SonarQube for IDE(SonarLint)·ESLint 확장을 권하고, 연결 모드 프로젝트 키를 맞춰 둠 |

처음 분석(2026-10-14, 로컬 SonarQube 26.10): 코드 24,125줄, 커버리지 53.2%, 중복 0.5%, 품질 게이트 **통과**. Bug 7건 중 5건(정렬 비교 함수, 처리 안 한 Promise)은 바로 고쳤고, 2건은 릴리스 노트 변환에서 코드 조각 자리표시로 일부러 쓰는 `\u0000`이라 그대로 둡니다. 보안 쪽 3건(md5로 파일 이름 만들기, 정리 확률용 `Math.random`, 주소 검사용 가짜 `http://` 기준 주소)은 보안과 상관없는 쓰임이라 SonarCloud 화면에서 사람이 확인 후 "Safe/Won't fix"로 표시할 대상입니다.

| 역할 | 지금 쓰는 것 |
|---|---|
| 에디터 안 즉시 검사 | SonarQube for IDE + ESLint |
| PR마다 자동 검사 | `ci.yml`(lint·typecheck·test·build) + `sonar.yml`(품질 게이트) |
| merge 막기 | 브랜치 보호 필수 검사 `check`(`main`은 `e2e`도) (품질 게이트 `sonar`를 필수로 더할 수 있음, 아래 8단계) |

## SonarCloud 연결하기 (저장소 관리자가 한 번)

1. https://sonarcloud.io 에 들어가 오른쪽 위 **Log in** → **GitHub**로 로그인합니다.
2. 오른쪽 위 **+** → **Analyze new project** → **Import an organization from GitHub**를 누르고, GitHub 화면에서 `handsomeguen` 조직을 고른 뒤 **Install**(저장소는 `blogville`만 골라도 됨).
3. SonarCloud로 돌아오면 조직 키를 묻습니다. `handsomeguen`으로 두고 무료(Free) 요금제로 **Create Organization**. 다른 키를 썼다면 GitHub 저장소 **Settings → Secrets and variables → Actions → Variables** 탭에 `SONAR_ORGANIZATION`을 그 키로 넣습니다.
4. 프로젝트 목록에서 `blogville`에 체크 → **Set Up**. "새 코드" 기준은 **Previous version**을 고릅니다. 프로젝트 키가 `handsomeguen_blogville`인지 확인합니다.
5. 프로젝트 화면 왼쪽 아래 **Administration → Analysis Method**에서 **Automatic Analysis**를 끕니다(GitHub Actions가 커버리지와 함께 분석하므로). 같은 화면의 **GitHub Actions** 안내에 나오는 토큰을 복사합니다(또는 오른쪽 위 내 아이콘 → **My Account → Security → Generate Tokens**).
6. GitHub 저장소 **Settings → Secrets and variables → Actions → New repository secret**: 이름 `SONAR_TOKEN`, 값은 방금 복사한 토큰.
7. Actions 탭 → **sonar** → **Run workflow**(branch: develop)를 눌러 처음 분석을 돌립니다. 끝나면 SonarCloud 프로젝트 화면에 결과가 보입니다.
8. (선택) 품질 게이트로 merge를 막으려면 GitHub **Settings → Rules → Rulesets → "main·develop 보호" → Require status checks**에 `sonar`를 더합니다.
9. VS Code에서 SonarQube for IDE 확장 → **Connected Mode** → **Add SonarQube Cloud Connection**, 연결 이름 `handsomeguen`, 조직 `handsomeguen`으로 만들면 `.vscode/settings.json`의 프로젝트와 이어져 서버와 같은 규칙으로 밑줄이 뜹니다.

## 직접 해 보기 (계정 없이, 내 컴퓨터에서)

```bash
docker compose --profile sonar up -d sonarqube   # 1~2분 뒤 http://localhost:9000 (처음 admin / admin, 새 비밀번호를 정하라고 나옴)
# 화면 오른쪽 위 내 아이콘 → My Account → Security → Generate Tokens (Type: Global Analysis Token)
npm run test:coverage                            # coverage/lcov.info 만들기
SONAR_HOST_URL=http://localhost:9000 SONAR_TOKEN=<만든 토큰> npm run sonar -- -Dsonar.qualitygate.wait=true
# 마지막 줄에 QUALITY GATE STATUS: PASSED 가 나오면 성공. http://localhost:9000 에서 결과 보기
docker compose --profile sonar down              # 끝나면 정리 (분석 결과는 sonar-data 볼륨에 남음)
```

해 볼 것:

1. 대시보드에서 Bug 하나를 열어 왜 문제인지 읽고, 그 줄을 고친 뒤 다시 분석해 사라지는지 봅니다.
2. **Quality Gates** 메뉴에서 기본 게이트(Sonar way)의 조건을 읽고, "새 코드 커버리지 80%"가 우리 프로젝트에 맞는지 생각해 봅니다.
3. VS Code에서 `src/lib/` 아래 파일을 열어 SonarQube for IDE 밑줄을 확인합니다.
