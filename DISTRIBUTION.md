# PXagents desktop distribution

설치형 앱은 사용자 컴퓨터에서 사무실 서버와 공식 Codex CLI를 실행합니다. Node.js 설치는 필요하지 않습니다. Tailscale은 원격 작업·tail웹 공유를 사용할 때 사용자가 별도 설치합니다.

## 사용자 흐름

1. 운영체제에 맞는 설치 파일로 앱을 설치하고 실행합니다.
2. 첫 실행 화면에서 **Codex 연결**을 누르고 브라우저에서 본인 ChatGPT 계정에 로그인합니다. 이미 로그인돼 있으면 바로 시작할 수 있습니다.
3. 원격 작업이 필요하면 Tailscale 설치·연결 안내를 열어 로그인한 뒤 **다시 확인**을 누릅니다. 로컬 작업은 Tailscale 없이 가능합니다.
4. **내 컴퓨터로 시작** 또는 **컴퓨터 선택하기**를 누릅니다. 원격 컴퓨터의 계정 정보는 접속 설정에서 입력합니다.
5. **일 시키기**로 작업합니다. 로컬 작업은 OS 폴더 선택창으로 시작 폴더를 지정할 수 있습니다.

계정 변경은 사무실 설정의 **Codex 계정·연결 설정**에서 합니다. 실행 중인 작업이 있으면 계정 연결을 변경할 수 없습니다.

## 지원 배포물

| OS | CPU | 설치 파일 |
| --- | --- | --- |
| Windows | x64 / ARM64 | NSIS `.exe` |
| macOS | Intel x64 / Apple Silicon ARM64 | `.dmg`, `.zip` |
| Linux desktop | x64 / ARM64 | `.AppImage`, `.deb` |

현대적인 64비트 데스크톱 환경을 대상으로 합니다. 모든 Linux 배포판이나 구형 OS를 검증한 것은 아닙니다. Linux AppImage는 FUSE 지원이 필요할 수 있습니다. Windows의 원격 SSH 작업은 OpenSSH Client가 필요합니다. 현재 SSH 작업 대상은 Linux/macOS/FreeBSD/OpenBSD이며, Windows 앱에서도 이 대상들에 접속해 작업할 수 있습니다.

## 로컬 개발과 빌드

개발·빌드에는 Node.js 22.9 이상이 필요합니다. 설치된 앱은 포함된 Electron 런타임을 사용합니다.

```sh
npm ci
npm run desktop
```

현재 운영체제와 CPU에 맞는 공식 Codex 패키지를 배포 리소스로 복사합니다. Codex 0.154.0의 플랫폼 리소스 전체를 포함하므로 code mode helper, ripgrep 등도 함께 배포됩니다. 다른 CPU용 빌드는 해당 CPU의 빌드 환경에서 실행합니다.

```sh
npm run dist:mac -- --arm64 --publish never
npm run dist:mac -- --x64 --publish never
npm run dist:win -- --x64 --publish never
npm run dist:linux -- --x64 --publish never
```

결과는 `release/`에 저장됩니다. Linux 공개 배포 시 `PX_MAINTAINER="이름 <실제 연락 이메일>"` 환경변수를 설정합니다. 미설정 베타 빌드는 예시 주소를 사용합니다. `node scripts/verify-desktop.mjs`는 포함된 Codex·앱 코드와 개인 데이터 제외를 확인합니다. `node scripts/smoke-desktop.mjs`는 패키징한 앱을 임시 프로필·임시 Codex 홈으로 실행해 첫 화면과 Codex 설치 상태를 확인합니다. Linux에서는 `xvfb-run -a node scripts/smoke-desktop.mjs`로 실행합니다.

## 자동 빌드

프로젝트를 GitHub 저장소에 올린 뒤 Actions의 **Desktop installers**를 수동 실행하거나 `v1.0.0` 형태의 버전 태그를 푸시합니다. `.github/workflows/desktop-build.yml`에 Windows/macOS/Linux 및 x64/ARM64의 여섯 빌드 환경을 준비했습니다.

빌드 결과는 Actions 아티팩트로 제공됩니다. `v*` 태그를 푸시하면 여섯 환경의 빌드와 검증이 모두 통과한 뒤 설치 파일, 설치 스크립트, SHA-256 체크섬을 GitHub 릴리스에 자동 게시합니다. 수동 실행은 Actions 아티팩트만 생성합니다. Windows는 플랫폼 공통 로그인·공유·askpass 테스트, macOS/Linux는 기존 백엔드 테스트도 실행합니다. 전체 브라우저 테스트는 Linux x64 환경에서 실행합니다.

## 공개 배포 서명

서명이 없는 빌드는 베타 검토용입니다. 일반 사용자 공개 배포를 위해 본인의 인증서로 서명합니다.

GitHub repository secrets:

- macOS: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`. Apple notarization: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- Windows: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`.

`CSC_LINK`는 electron-builder가 지원하는 인증서 파일/URL/Base64 값을 사용합니다. 로컬 빌드는 `CSC_LINK`, `CSC_KEY_PASSWORD` 환경변수로 설정합니다. macOS notarization은 로컬에서 `PX_NOTARIZE=1`과 위 Apple 환경변수를 설정합니다. 인증서를 소스나 배포 파일에 넣지 않습니다.

서명·공증이 없는 상태에서는 OS의 다운로드 앱 실행 경고가 나타날 수 있습니다. 현재 실제 생성한 설치 파일의 서명 여부와 다른 OS 검증 완료 여부는 작업 결과 보고를 확인하세요.

## 저장과 실행

- 앱 데이터는 Electron의 사용자별 `userData` 경로에 저장합니다. 일반적으로 Windows `%APPDATA%/PXagents`, macOS `~/Library/Application Support/PXagents`, Linux `~/.config/PXagents`입니다.
- 기존 개발용 `data/`, `.env`, `.codex`, 작업 기록과 계정은 설치 파일에 포함하지 않습니다. 기존 개발 사무실의 데이터도 자동으로 가져오지 않습니다.
- Codex 인증은 공식 Codex가 관리하며, 사용자 홈의 기존 인증 저장소를 재사용합니다. 앱은 토큰을 UI나 배포물로 복사하지 않습니다.
- 데스크톱 접속 비밀번호와 API 키는 OS 보안 저장소를 사용해 암호화한 `secrets.json`으로 저장합니다. macOS Keychain, Windows DPAPI, Linux GNOME Keyring/KWallet 기반입니다. Linux에서 보안 저장소가 없으면 비밀번호의 영구 저장이 실패하며, 평문 저장으로 대체하지 않습니다.
- 서버는 사용 가능한 로컬 포트를 자동 선택하고 앱 전용 세션으로 인증합니다. 다른 로컬 웹페이지가 앱 API를 자유롭게 호출하도록 공개하지 않습니다.
- 앱은 한 인스턴스만 실행합니다. 두 번 실행하면 열린 앱을 앞으로 가져옵니다. 종료 시 서버에 종료 요청을 전달하고 진행 중인 작업의 상태를 저장합니다. 이미 변경한 작업 파일은 되돌리지 않습니다.
- `tail웹` 결과 공유는 Tailscale IPv4 주소의 전용 HTTP 포트(기본 3212)를 사용합니다. 공유 주소에는 작업별 임의 토큰을 포함하며 사무실 관리 API는 제공하지 않습니다. 앱 서버가 실행 중이어야 열립니다. 포트가 사용 중이거나 Tailscale이 끊겨 있으면 편지에 공유 오류를 표시합니다. `TAIL_WEB_PORT`로 공유 포트를 지정할 수 있습니다.

## 배포 검증 범위

설치 후에는 로그인 성공·취소, 로컬 폴더 작업, 원격 SSH 작업, 비밀번호 재시작 후 유지, 비둘기 질의, Goal, tail웹 링크를 대상 OS에서 확인합니다. 자동 실행 테스트는 사람의 실제 ChatGPT 로그인 완료나 실제 원격 컴퓨터 작업까지 대신하지 않습니다. macOS에서는 Finder로 DMG를 설치한 뒤 앱 실행도 확인해야 합니다.

포함된 오픈소스·폰트·사운드 고지는 `THIRD-PARTY-NOTICES.md`를 참조하세요.
