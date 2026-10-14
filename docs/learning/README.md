# 학습 문서

Blogville 저장소의 **실제 파일**을 예로 들어, 함께 개발하고 운영하는 데 필요한 도구를 순서대로 익히는 문서입니다. 각 문서는 **개념 → 우리 프로젝트에서는 → 직접 해 보기** 세 부분으로 되어 있습니다.

> 함께 만들고 **Git Flow** → 만들고 **빌드** → 검사하고 **Sonar** → 포장하고 **Docker** → 자동으로 **CI/CD** → 멈추지 않게 운영한다 **MSA**

## 1순위: 지금 바로 (함께 만들기 기초)

| 문서 | 내용 |
|---|---|
| [01. Git Flow 브랜치 전략](01-git-flow.md) | `main`·`develop`·`feature`·`release`·`hotfix`, PR 규칙, 브랜치 보호 |
| [02. 빌드 도구](02-build.md) | Gradle 대신 npm scripts, `gradle build` ↔ `npm run verify` 대응표 |
| [03. 코드 품질 (SonarLint 부분)](03-sonar.md) | 에디터 안 SonarLint 설치와 경고 읽기 |
| [04. Docker로 실행해 보기](04-docker.md) | Dockerfile 단계, 이미지 만들고 띄우기 |

## 2순위: 프로젝트 중반 (자동화)

| 문서 | 내용 |
|---|---|
| [05. GitHub Actions CI/CD](05-github-actions.md) | 워크플로 9개, 이미지 자동 배포 흐름 |
| [06. GitHub Secrets](06-secrets.md) | 시크릿 목록과 다루는 원칙 (값은 적지 않음) |
| [03. 코드 품질 (품질 게이트 부분)](03-sonar.md#개념) | SonarQube 서버와 품질 게이트 |
| [07. Jenkins (개념)](07-jenkins.md) | Actions와 비교, 같은 단계의 Jenkinsfile 예시 |

## 3순위: 서비스가 커지면 (확장과 운영)

| 문서 | 내용 |
|---|---|
| [08. 무중단 배포](08-zero-downtime.md) | nginx + blue/green 컨테이너, `run.sh` 교체 순서, 되돌리기 |
| 09. MSA로 서비스 나누기 | 준비 중 |
| 10. API Gateway | 준비 중 |
| 11. Service Discovery | 준비 중 |

함께 보면 좋은 문서: [개발환경](../dev-environment.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [저장소 README](../../README.md)
