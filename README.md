<p align="center"><img src="public/assets/favicon.svg" width="88" alt="PXagents 로고"></p>
<h1 align="center">PXagents 2.0</h1>
<p align="center"><b>내 ChatGPT 구독으로 운영하는 픽셀 멀티에이전트 사무실</b></p>
<p align="center">
  <a href="https://github.com/choimagon/PXagent/releases/latest"><img src="https://img.shields.io/badge/version-2.0.0-91b77a?style=flat-square" alt="버전 2.0.0"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-546b49?style=flat-square" alt="Windows, macOS, Linux">
  <img src="https://img.shields.io/badge/CPU-x64%20%C2%B7%20ARM64-546b49?style=flat-square" alt="x64, ARM64">
</p>
<p align="center"><b>한국어</b> · <a href="README.en.md">English</a> · <a href="https://github.com/choimagon/PXagent/releases/latest">설치파일 다운로드</a> · <a href="#설치">설치</a> · <a href="#삭제">삭제</a> · <a href="#기능">기능</a></p>

![PXagents 2.0 픽셀 사무실 — 데모 모드](demo_img.png)

**PXagents는 OpenAI의 ChatGPT 구독을 이용해 Codex를 멀티에이전트로 구성한 데스크톱 앱입니다.** 하나의 요청을 총괄·개발·글쓰기·편집 담당으로 나누고, 각 담당자가 자기 모델과 지침으로 작업하도록 연결합니다. 본인 ChatGPT 계정으로 로그인하면 구독 기반 Codex를 사용하며, 별도의 API 키 입력 없이 시작할 수 있습니다.

사장님은 **일 시키기**로 요청하고, 동료들은 픽셀 사무실에서 일합니다. 비서에게 진행 상황을 물어보고, 편지함에서 결과를 확인하세요. 위 이미지는 실제 코드 수정 결과를 주장하는 화면이 아닌 **데모 모드 화면**입니다.

## 사용 전 준비

| 구분 | 필요한 항목 |
| --- | --- |
| 모든 OS | Codex 사용 권한이 있는 본인 ChatGPT 구독 계정, 인터넷 연결, 로그인용 웹브라우저 |
| 앱에 포함 | Electron/Node.js 런타임, 공식 Codex CLI와 플랫폼별 실행 리소스 — 따로 설치할 필요 없음 |
| 다른 컴퓨터에 작업 요청 | 앱 실행 PC와 대상 PC의 [Tailscale](https://tailscale.com/download) 연결, 앱 실행 PC의 SSH 클라이언트, 대상 PC의 SSH 서버 |
| 작업에 필요한 도구 | Python·Git·컴파일러 등은 실제로 요청한 작업에 따라 해당 작업 PC에 설치 |

로컬 작업만 하면 Tailscale과 SSH는 필요하지 않습니다. 구독의 모델 제공 범위와 사용량 제한은 OpenAI 정책을 따릅니다. [OpenAI 공식 Codex 요금 안내](https://developers.openai.com/codex/pricing)

## 설치

### Windows — EXE 설치파일 권장

**설정 → 시스템 → 정보 → 시스템 종류**에서 CPU 종류를 확인한 뒤 파일을 선택하세요.

| 내 컴퓨터 | 설치파일 |
| --- | --- |
| Intel / AMD의 일반 64비트 PC, `x64 기반 프로세서` | [PXagents-windows-x64.exe](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-x64.exe) |
| Snapdragon 등 Windows on ARM PC, `ARM 기반 프로세서` | [PXagents-windows-arm64.exe](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-arm64.exe) |

1. CPU에 맞는 `.exe`를 다운로드하고 실행합니다.
2. 첫 화면의 입력값 **`i`**를 유지하고 **다음**을 누릅니다.
3. 설치 위치를 선택해 설치하고, 시작 메뉴 또는 바탕화면에서 **PXagents**를 실행합니다.

32비트 Windows용 설치파일은 제공하지 않습니다. Node.js·npm·Codex CLI를 별도로 설치할 필요는 없습니다.

**원격 작업을 사용할 때:** Tailscale을 설치하고 로그인합니다. OpenSSH Client가 없으면 **관리자 PowerShell**에서 설치하세요. [Microsoft 설치 안내](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

### macOS — 터미널로 설치

**터미널**에 아래 명령을 실행합니다. Intel Mac은 x64, M1·M2·M3·M4 등 Apple Silicon Mac은 ARM64로 자동 감지합니다.

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh i
```

설치 후 실행:

```sh
open "$HOME/Applications/PXagents.app"
```

설치 위치는 `~/Applications/PXagents.app`입니다. `curl`, `sh`, `ditto`, `shasum` 등 macOS 기본 도구를 사용하므로 Homebrew나 별도 Node.js 라이브러리가 필요하지 않습니다. 원격 작업에는 Tailscale을 별도로 설치하고, macOS에 포함된 SSH 클라이언트를 사용합니다.

직접 다운로드하려면 [Apple Silicon ZIP](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-mac-arm64.zip) / [Intel ZIP](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-mac-x64.zip)을 선택하세요. DMG도 [릴리스 페이지](https://github.com/choimagon/PXagent/releases/latest)에 제공합니다.

### Linux — 의존성 준비 후 명령어로 설치

그래픽 데스크톱 세션이 필요합니다. 설치 스크립트는 x86_64/amd64를 x64로, aarch64/arm64를 ARM64로 자동 감지합니다. GTK·NSS·GBM·ALSA 런타임과 인증서·다운로드·압축 도구가 필요합니다. SSH 비밀번호를 저장하려면 **Secret Service를 제공하는 GNOME Keyring 또는 KWallet**이 실행 중이어야 합니다.

**Ubuntu 24.04 계열:**

```sh
sudo apt-get update
sudo apt-get install -y curl ca-certificates tar coreutils libgtk-3-0 libnss3 libgbm1 libasound2t64 libsecret-1-0 gnome-keyring
```

**Ubuntu 22.04 계열:**

```sh
sudo apt-get update
sudo apt-get install -y curl ca-certificates tar coreutils libgtk-3-0 libnss3 libgbm1 libasound2 libsecret-1-0 gnome-keyring
```

다른 배포판에서는 이에 대응하는 런타임 패키지를 설치하세요. 원격 작업을 사용할 경우 `openssh-client`와 Tailscale도 필요합니다. 설치 명령:

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh i
"$HOME/.local/bin/pxagents"
```

앱은 `~/.local/opt/pxagents`에 설치되고 앱 메뉴에 등록됩니다. 설치 스크립트의 TAR 배포는 Chromium의 사용자 네임스페이스 샌드박스를 사용합니다. Ubuntu 24.04 등에서 이 기능이 제한돼 앱이 실행되지 않으면 **릴리스의 CPU에 맞는 `.deb`**를 내려받아 설치하세요.

```sh
# 다운로드한 파일이 있는 폴더에서 실행
sudo apt install ./PXagents-2.0.0-linux-x64.deb
# ARM64 시스템은 대신 다음 파일 사용
# sudo apt install ./PXagents-2.0.0-linux-arm64.deb
```

AppImage를 선택한 경우 FUSE 2 런타임이 추가로 필요할 수 있습니다. [모든 Linux 설치파일](https://github.com/choimagon/PXagent/releases/latest)

> 설치 스크립트는 릴리스의 SHA-256 체크섬을 확인합니다. 업데이트할 때는 앱을 종료하고 같은 설치 명령을 다시 실행하세요. 서명·공증되지 않은 배포물은 Windows SmartScreen 또는 macOS 보안 확인이 나타날 수 있습니다.

## 삭제

### Windows

**설정 → 앱 → 설치된 앱 → PXagents → 제거**를 선택하세요. 기존 `.exe` 설치파일을 다시 실행하고 첫 화면에 **`c`**를 입력해도 삭제할 수 있습니다.

### macOS

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh c
```

### Linux

앱을 종료한 뒤, 설치 스크립트로 설치했다면:

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh c
```

`.deb`로 설치했다면:

```sh
sudo apt remove px-agents-office
```

삭제는 앱 실행파일과 바로가기를 제거합니다. **저장된 작업·편지·설정과 계정 정보는 유지**하며, 앱 안의 기록만 정리하려면 각 화면의 **🗑️ 비우기**를 사용하세요.

## 처음 실행

1. 앱에서 **Codex 연결**을 누르고 브라우저로 본인 ChatGPT 계정에 로그인합니다.
2. 로컬 작업은 **내 컴퓨터로 시작**, 원격 작업은 Tailscale 연결을 확인하고 **컴퓨터 선택하기**를 누릅니다.
3. 사무실에서 **일 시키기**를 눌러 요청과 작업 폴더를 지정합니다.
4. 사이드바에서 실행 상황을 확인하고 완료된 결과는 **편지함**에서 읽습니다.

앱은 현재 한국어 UI를 제공합니다. Codex는 지정한 작업에 대해 파일과 명령을 실행하며, 앱의 실행 설정은 추가 승인 없이 작업하는 방식입니다.

## 기능

### 역할을 나누는 7명의 에이전트

| 부서 | 기본 이름 | 맡는 일 |
| --- | --- | --- |
| 사장실 | 호문클루스 | 요청 해석, 담당자 배정, 결과 검토와 최종 보고 |
| 사장실 | 비둘기 | 실제 작업·로그를 근거로 진행 상황 안내. 총괄이 배정·제어하는 작업자와 분리 |
| 개발부서 | 개발노예 | 개발·디버깅·설계와 막내 작업 검토 |
| 개발부서 | 따까리 | 작은 UI 수정, 단순 버그, 테스트 등 범위가 좁은 개발 작업 |
| 논문부서 | 글싸게 | 초안 작성, 글쓰기와 연구 문서 작업 |
| 논문부서 | 양식이 | 편집, 문서 구조와 양식·참고문헌 정리 |
| 잡다부서 | 말똥이 | 정리, 아이디어와 일상 잡무 |

캐릭터 또는 명패를 클릭하면 **작업 배정**이 맨 위에 나타납니다. 담당자별 역할 지침과 고정 프롬프트를 저장할 수 있고, 이름 옆 **연필 버튼**에서 이름과 외형을 바꿀 수 있습니다. 마법사·로봇·닌자·고양이·펭귄 등 **26종 픽셀 캐릭터**를 제공합니다.

### 모델·추론 프리셋

사무실 오른쪽 위 **🤖 버튼**에서 전체 에이전트 조합을 한 번에 맞춥니다. 현재 모델·레벨 조합은 이름을 붙여 **내 프리셋**으로 저장하고 다시 적용할 수 있습니다. 프리셋은 사무실별로 유지됩니다.

| 에이전트 | 상급 | 중급 | 하급 |
| --- | --- | --- | --- |
| 호문클루스 | Astra / High | Sol / XHigh | Terra / High |
| 개발노예 | Sol / High | Terra / XHigh | Terra / Medium |
| 글싸게 | Sol / High | Terra / XHigh | Luna / XHigh |
| 양식이 | Terra / High | Terra / Medium | Luna / XHigh |
| 따까리·말똥이·비둘기 | Luna / Medium 고정 | Luna / Medium 고정 | Luna / Medium 고정 |

고정된 세 에이전트 외에는 사이드바에서 모델과 추론 레벨을 개별 조정할 수 있습니다. 변경은 다음 모델 호출부터 적용됩니다.

### 부서별 Fast 모드와 사무실 연출

부서 오른쪽 위 버튼으로 **Normal ↔ Fast**를 전환합니다. 해당 부서의 다음 Codex 호출에 적용되며 설정은 저장됩니다. Fast에서는 캐릭터 머리 위에 픽셀 불꽃이 나타나고, 사장실은 밤 창문과 바닥 책, 개발부서는 서버 냉각 장치·배관·팬, 논문부서는 책더미, 잡다부서는 늘어난 택배박스와 기울어진 전광판으로 바뀝니다.

Fast는 지원 모델의 응답을 빠르게 처리하는 대신 구독 사용량을 더 소비합니다. 적용 가능 모델과 배율은 [OpenAI 공식 Fast 모드 안내](https://developers.openai.com/codex/speed)를 확인하세요.

### 작업·Goal·진행 상황

직접 담당자를 선택하거나 총괄에게 배정을 맡길 수 있습니다. **Goal**은 목표와 완료 기준을 정하고 결과를 검토하면서 후속 회차를 이어갑니다. 작업 현황에서 상태·실행 단계·로그·결과를 확인하고 중지·재실행·이어서 작업을 사용할 수 있습니다. 같은 담당자의 작업은 대기열로 관리하고, 다른 담당자는 병렬로 일할 수 있습니다.

**비둘기**에게 “지금 무슨 일 하고 있어?”처럼 물으면 실제 작업과 로그를 기반으로 알려줍니다. 사이드바에는 구독 사용량과 조회 가능한 초기화권 정보도 표시합니다.

### 편지함·활동 기록·비우기

완료·실패·중지된 작업의 보고는 편지함에 도착합니다. 읽음 표시, 결과 복사·다운로드, 뽀로롱 알림음과 작업 중 키보드 소리를 제공합니다. 활동 기록에서는 에이전트가 수행한 단계와 실행 이벤트를 볼 수 있습니다.

편지함·작업 현황·활동 기록의 **🗑️ 비우기**에서 **전체 삭제** 또는 **선택한 날짜 이전 삭제**를 고릅니다. 대상 개수를 확인한 뒤 삭제하며, 선택한 당일의 기록은 남습니다. 작업 정리에서는 실행·대기 중인 작업과 진행 중인 Goal을 유지합니다. 각 종류의 기록은 별도로 삭제하며, 자동으로 날짜가 바뀌어 리셋되지 않습니다. 활동 로그는 최근 1,000개까지 유지합니다.

### 컴퓨터별 사무실과 tail웹

Tailscale에 연결된 컴퓨터를 감지하고, 컴퓨터마다 독립된 사무실·작업·편지·프리셋을 관리합니다. 원격 접속 계정과 SSH 설정을 저장할 수 있습니다. **Codex는 앱 실행 PC에서 실행하고**, 원격 파일과 명령은 SSH로 처리합니다. 원격 작업 대상은 현재 Linux·macOS 등의 Unix 환경입니다.

**tail웹**을 켜면 작업 결과를 웹페이지로 공유하고 편지에 링크를 넣습니다. 같은 Tailscale 네트워크에서 앱이 실행 중일 때 열 수 있습니다. 데스크톱의 접속 비밀번호는 OS 보안 저장소를 통해 암호화합니다.

## 에셋과 라이선스

| 구성요소 | 출처·조건 |
| --- | --- |
| 픽셀 캐릭터·사무실·가구·로고·불꽃 | 프로젝트 코드로 직접 제작한 SVG. 외부 게임 스프라이트·유료 에셋팩 사용 없음 |
| Galmuri11 폰트 | [Galmuri / quiple](https://github.com/quiple/galmuri) · [SIL OFL 1.1](public/assets/Galmuri-LICENSE.md) |
| 키보드 타이핑 효과음 | [Keyboard Typing 7 / grcekh](https://freesound.org/people/grcekh/sounds/546164/) · [CC0 1.0](public/assets/keyboard-typing-CREDITS.md) |

외부 구성요소 고지는 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)를 참고하세요. 앱과 직접 제작한 그래픽의 별도 재사용 라이선스는 아직 지정하지 않았습니다. 배포물에는 개인 작업 기록·로그인 파일·SSH 비밀번호를 포함하지 않습니다.
