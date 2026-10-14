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

지금 실제 설정은 클라우드 쪽에서 만들고 있습니다. 들어오면 아래 파일을 보세요.

- `sonar-project.properties`: 분석할 폴더(`src/`), 제외할 폴더, 커버리지 보고서 위치를 적는 SonarQube 설정
- `.vscode/` (확장 추천·설정): VS Code에서 SonarLint 확장을 권하고 연결 모드를 맞추는 설정

이미 있는 품질 장치도 같은 역할을 나눠 맡고 있습니다.

| 역할 | 지금 쓰는 것 |
|---|---|
| 에디터 안 즉시 검사 | ESLint (`eslint.config.mjs`) |
| PR마다 자동 검사 | `ci.yml`의 lint · typecheck · test · build |
| merge 막기 | 브랜치 보호 규칙의 필수 검사 `check` |

SonarQube가 붙으면 여기에 "중복률·복잡도·보안 핫스팟·커버리지"가 더해지고, 품질 게이트가 또 하나의 필수 검사가 됩니다.

## 직접 해 보기

1. VS Code에서 확장 **SonarQube for IDE**(예전 SonarLint)를 설치합니다.
2. `src/lib/` 아래 아무 파일을 열고 문제(Problems) 창에 Sonar 경고가 뜨는지 봅니다.
3. 일부러 `if (a == b)`나 쓰지 않는 변수를 넣어 경고가 생기는지 확인한 뒤 되돌립니다.
4. 설정 파일이 들어오면 `sonar-project.properties`를 열어 `sonar.sources`, `sonar.exclusions`, `sonar.javascript.lcov.reportPaths`가 무엇을 가리키는지 읽어 봅니다.
5. 생각해 볼 것: 우리 품질 게이트를 정한다면 "새 코드 커버리지 몇 %"가 현실적일까요? 커버리지를 재려면 `@vitest/coverage-v8`을 devDependencies에 더하고 `npx vitest run --coverage`를 돌려야 해요(지금은 설치돼 있지 않아요).
