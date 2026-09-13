<p align="center"><img src="public/assets/favicon.svg" width="96" alt="PXagents 로고"></p>
<h1 align="center">PXagents</h1>
<p align="center">내 Codex 계정으로 일하는 픽셀 에이전트 사무실</p>
<p align="center"><b>한국어</b> · <a href="README.en.md">English</a> · <a href="https://github.com/choimagon/PXagent/releases/latest">다운로드</a></p>

![PXagents 사무실 데모](demo_img.png)

호문클루스에게 일을 맡기면 개발, 글쓰기, 양식 담당 에이전트가 협력합니다. 비서 비둘기에게 진행 상황을 물어보고, 편지함에서 결과를 확인하세요. 로컬 컴퓨터와 Tailscale로 연결한 컴퓨터마다 사무실을 따로 사용할 수 있습니다.

## 설치와 삭제

**Windows**: [x64 설치 파일](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-x64.exe) / [ARM64 설치 파일](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-arm64.exe)을 실행하세요. 첫 화면에서 **`i`를 입력하면 설치**, **`c`를 입력하면 삭제**합니다. 설치 후 시작 메뉴나 바탕화면에서 PXagents를 실행하세요. Windows 설정의 앱 목록에서도 삭제할 수 있습니다.

**macOS / Linux**: 터미널에 아래 한 줄을 붙여넣으세요. **`i` 설치 / `c` 삭제**를 선택합니다. OS와 CPU를 자동으로 감지합니다.

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh | sh
```

파일로 받아 실행해도 됩니다.

```sh
curl -fLO https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh
sh install.sh
```

설치는 macOS의 사용자 Applications 폴더, Linux의 사용자 앱 목록에 등록됩니다. 삭제는 앱을 제거하며 저장된 작업과 계정 정보는 유지합니다. 업데이트는 설치 명령을 다시 실행하고 `i`를 선택하세요. 앱을 종료한 상태에서 업데이트·삭제하세요.

첫 배포는 서명되지 않은 빌드입니다. Windows SmartScreen 또는 macOS 보안 확인이 나타날 수 있습니다. Linux는 GTK/NSS 등 데스크톱 라이브러리와 Chromium 샌드박스를 지원하는 환경이 필요합니다. Ubuntu 24.04 등 사용자 네임스페이스를 제한하는 환경에서는 [릴리스의 `.deb`](https://github.com/choimagon/PXagent/releases/latest)를 사용하세요.

## 처음 실행

1. 앱을 실행하고 **Codex 연결**을 누릅니다.
2. 브라우저에서 **본인 ChatGPT 계정**으로 로그인합니다.
3. Tailscale 연결을 확인합니다. 로컬 작업만 할 경우 건너뛸 수 있습니다.
4. 컴퓨터를 선택하고 **일 시키기**를 누릅니다.

Codex 실행 파일은 앱에 포함됩니다. Node.js나 Codex CLI를 따로 설치할 필요가 없습니다. Codex 사용 권한이 있는 본인 계정이 필요하며 계정의 사용량 제한이 적용됩니다. Tailscale은 [별도로 설치하고 로그인](https://tailscale.com/download)하세요.

## 기능

- 담당자별 모델·추론 수준, Goal 작업, 이전 작업 이어서 하기
- 컴퓨터별 독립 사무실, Tailscale 컴퓨터 자동 감지, SSH 계정 설정 저장
- 편지함 결과·알림, 진행 상황을 확인하는 비서 비둘기
- **tail웹**: 작업 결과를 웹사이트로 만들어 Tailscale 안에서 공유하고 편지에 클릭 가능한 링크 제공

Codex는 앱을 실행한 컴퓨터에서만 실행합니다. 다른 컴퓨터의 작업은 Tailscale 네트워크를 통한 SSH 터미널로 수행합니다. 원격 대상은 현재 Linux·macOS 등 Unix 환경을 지원하며 SSH 접근 설정이 필요합니다. Windows에서도 앱을 실행해 Unix 컴퓨터에 작업을 맡길 수 있습니다. 저장한 SSH 비밀번호는 데스크톱 앱의 OS 보안 저장소로 암호화합니다.

## 개발과 배포

Node.js 22.9 이상이 필요합니다.

```sh
git clone https://github.com/choimagon/PXagent.git
cd PXagent
npm ci
npm run desktop
```

```sh
npm test
npm run dist
```

`v*` 태그를 올리면 GitHub Actions가 Windows·macOS·Linux의 x64 / ARM64 빌드를 검증하고 릴리스에 게시합니다. 설치 스크립트는 릴리스의 SHA-256 체크섬을 검증합니다. 서명 설정과 개발용 웹 실행 방법은 [배포 안내](DISTRIBUTION.md)를 참고하세요.

앱의 배포에는 개인 데이터, Codex 로그인 파일, SSH 비밀번호가 포함되지 않습니다. 외부 구성요소의 라이선스는 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)에 있습니다. 앱 자체의 별도 오픈소스 라이선스는 아직 지정하지 않았습니다.
