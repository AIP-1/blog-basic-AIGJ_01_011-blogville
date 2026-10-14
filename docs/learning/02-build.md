# 02. 빌드 도구: Gradle 대신 npm scripts

## 개념

빌드 도구는 "의존성 받기 → 컴파일 → 검사 → 테스트 → 묶기"를 명령 하나로 똑같이 되풀이하게 해 줍니다. 자바 진영의 Gradle·Maven이 대표적이고, 자바스크립트·타입스크립트 진영에서는 `package.json`의 `scripts`와 npm이 같은 역할을 합니다.

| Gradle | npm (이 저장소) | 설명 |
|---|---|---|
| `build.gradle`의 `dependencies { }` | `package.json`의 `dependencies`·`devDependencies` | 쓰는 라이브러리 목록. `devDependencies`는 개발·시험에만 필요 |
| `gradle build` (컴파일+검사+테스트+jar) | `npm run verify` | 한 번에 전부 확인. lint → typecheck → 커버리지를 재는 단위 테스트(`test:coverage`) → build를 차례로 돌립니다 |
| `gradle compileJava` | `npm run typecheck` | 타입 오류 확인 (`tsc --noEmit`) |
| `gradle check` / Checkstyle | `npm run lint` | 코드 규칙 검사 (ESLint, `eslint.config.mjs`) |
| `gradle test` (JUnit) | `npm test` | 단위 테스트 (Vitest, `vitest.config.mts`) |
| `gradle bootJar` | `npm run build` | 운영용 결과물 만들기 (`next build` → `.next/`) |
| `gradle bootRun` | `npm run dev` / `npm start` | 개발 서버 / 빌드한 결과 실행 |
| Gradle Wrapper(`gradlew`) + 잠금 파일 | `package-lock.json` + `npm ci` | 누구 컴퓨터에서나 같은 버전을 받게 고정. `npm ci`는 lock 파일 그대로만 설치 |
| `~/.gradle` 캐시 | `node_modules/`, `~/.npm` | 받은 라이브러리 저장소 |
| 사용자 정의 task | `scripts`의 나머지 항목 | `db:migrate`, `db:seed`, `admin:create`, `posts:cleanup` 등 |

`npm install`은 `package.json`을 보고 lock 파일을 **고칠 수 있지만**, `npm ci`는 lock 파일과 다르면 실패합니다. 그래서 CI와 도커 빌드는 항상 `npm ci`를 씁니다.

## 우리 프로젝트에서는

- 스크립트 목록: [package.json](../../package.json)의 `scripts`
- CI가 같은 순서로 돌림: [.github/workflows/ci.yml](../../.github/workflows/ci.yml) → `npm ci` → `lint` → `typecheck` → `test` → `build`
- 도커 이미지도 같은 명령을 씀: [Dockerfile](../../Dockerfile)의 `RUN npm ci`, `RUN npm run build`
- Node 버전은 22로 통일(로컬·CI·도커). Gradle의 `toolchain`에 해당합니다.

## 직접 해 보기

```bash
npm ci                 # lock 파일 그대로 설치 (node_modules를 지우고 새로 받음)
npm run lint
npm run typecheck
npm test
npm run build          # .next/ 폴더가 생깁니다
npm start              # 빌드한 결과를 http://localhost:3000 에서 실행
```

해 볼 것:

1. `npm ls zod`로 의존성이 어떤 버전으로 깔렸는지 봅니다(`gradle dependencies`와 비슷).
2. `npm outdated`로 새 버전이 나온 라이브러리를 봅니다.
3. 일부러 타입 오류를 하나 넣고 `npm run typecheck`가 실패하는지 확인한 뒤 되돌립니다.
4. 위 네 명령 대신 `npm run verify` 하나로 돌려 보고, 끝에 나오는 커버리지 요약(Statements·Lines %)을 읽어 봅니다.
