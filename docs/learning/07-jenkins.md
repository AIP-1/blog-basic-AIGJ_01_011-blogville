# 07. Jenkins (개념)

## 개념

Jenkins는 직접 설치해 운영하는 CI/CD 서버입니다. GitHub Actions가 "GitHub이 빌려 주는 러너 + 저장소 안 YAML"이라면, Jenkins는 "우리가 띄운 서버 + 저장소 안 `Jenkinsfile`(Groovy 문법)"입니다.

| 비교 | GitHub Actions | Jenkins |
|---|---|---|
| 실행 위치 | GitHub 호스팅 러너(또는 자체 러너) | 우리 서버(컨트롤러 + 에이전트) |
| 정의 파일 | `.github/workflows/*.yml` | `Jenkinsfile` |
| 단위 | workflow → job → step | pipeline → stage → step |
| 트리거 | `on: pull_request` 등 | 웹훅, SCM 폴링, cron |
| 비밀 값 | Secrets (`secrets.X`) | Credentials (`credentials('id')`, `withCredentials`) |
| 확장 | Marketplace의 action | 플러그인 |
| 관리 부담 | 거의 없음 | 서버·플러그인 업데이트, 보안 패치를 직접 |

회사·학교 내부망처럼 외부 러너를 쓸 수 없거나, 빌드 서버를 직접 통제해야 할 때 Jenkins를 많이 씁니다.

## 우리 프로젝트에서는

Blogville은 GitHub Actions를 씁니다(Jenkins 서버는 없습니다). 비교를 위해 [ci.yml](../../.github/workflows/ci.yml)의 `check` job과 **같은 단계**를 Jenkins로 옮기면 이렇게 됩니다. 이 코드는 공부용 예시이고, 저장소에 `Jenkinsfile`로 두지 않습니다.

```groovy
// Jenkinsfile (예시) — ci.yml의 check job과 같은 단계
pipeline {
  agent { docker { image 'node:22' } }      // setup-node@v4 (node-version: 22)

  environment {
    NEXT_TELEMETRY_DISABLED = '1'
    npm_config_cache = "${WORKSPACE}/.npm"   // cache: npm
  }

  options {
    disableConcurrentBuilds(abortPrevious: true)   // concurrency: cancel-in-progress
    timeout(time: 30, unit: 'MINUTES')
  }

  triggers {
    // GitHub 웹훅이 기본. 웹훅이 없으면 폴링
    pollSCM('H/5 * * * *')
  }

  stages {
    stage('패키지 설치') { steps { sh 'npm ci' } }
    stage('lint')        { steps { sh 'npm run lint' } }
    stage('타입 검사')    { steps { sh 'npm run typecheck' } }
    stage('단위 테스트')  { steps { sh 'npm test' } }
    stage('빌드')        { steps { sh 'npm run build' } }
  }

  post {
    failure { echo '검사 실패: PR을 merge하지 마세요' }
  }
}
```

배포까지 옮긴다면 `stage('배포') { when { branch 'main' } ... }`에서 `withCredentials([usernamePassword(credentialsId: 'ssh-server', ...)])`로 SSH 시크릿을 꺼내 `deploy/run.sh`를 부르는 모양이 됩니다. Actions의 `secrets.SSH_PASSWORD`가 Jenkins Credentials로 바뀌는 셈입니다.

## 직접 해 보기

```bash
# 로컬에서 Jenkins 띄워 보기 (연습 후 지우기)
docker run -d --name jenkins-practice -p 8080:8080 jenkins/jenkins:lts
docker exec jenkins-practice cat /var/jenkins_home/secrets/initialAdminPassword
# http://localhost:8080 → 추천 플러그인 설치 → New Item → Pipeline
# → Pipeline script에 위 예시에서 agent를 `agent any`로 바꿔 붙여 넣고 Build Now
docker rm -f jenkins-practice
```

해 볼 것:

1. Stage View에서 단계 이름이 Actions의 step 이름과 같은지 비교합니다.
2. 위 표를 보고 "우리 프로젝트가 Jenkins로 옮기면 새로 해야 할 일"을 세 가지 적어 봅니다(서버 관리, 웹훅 연결, Credentials 등록 등).
