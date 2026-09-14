# PXagents 2.0

ChatGPT 구독 기반 Codex를 역할별 에이전트로 구성한 픽셀 사무실입니다.

## 이번 버전

- 상급·중급·하급 모델/추론 프리셋과 사무실별 내 프리셋 저장
- 따까리·말똥이·비둘기의 Luna / Medium 고정
- 부서별 Fast / Normal 토글, 냉각 장치·밤 창문·책더미·택배박스와 픽셀 불꽃
- 이름 옆 연필 버튼으로 이름·외형 변경, 선택 가능한 캐릭터 26종
- 캐릭터 상세창 상단 작업 배정과 정리된 버튼 배치
- 편지함·작업 현황·활동 기록의 비우기: 전체 또는 선택 날짜 이전 삭제와 대상 개수 확인
- 삭제된 편지 재시작 후 복원 방지와 진행 중 작업/Goal 보호
- 더 크게 조정한 완료 알림음
- OS·CPU별 설치/삭제 안내, 런타임 의존성 안내, 갱신된 데모 이미지

## 설치파일 선택

| OS | Intel / AMD x64 | ARM64 |
| --- | --- | --- |
| Windows | `PXagents-windows-x64.exe` | `PXagents-windows-arm64.exe` |
| macOS | `PXagents-mac-x64.zip` | `PXagents-mac-arm64.zip` |
| Linux | `PXagents-linux-x64.tar.gz` | `PXagents-linux-arm64.tar.gz` |

Windows는 CPU에 맞는 EXE를 실행하고 `i`로 설치합니다. 삭제는 Windows 설정의 설치된 앱에서 하거나 EXE를 다시 실행해 `c`를 선택합니다.

macOS·Linux 설치:

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh i
```

삭제는 마지막 줄을 `sh /tmp/pxagents-install.sh c`로 바꿉니다. 저장된 작업과 계정 정보는 유지합니다.

macOS DMG와 Linux DEB/AppImage도 함께 제공합니다. 릴리스의 `SHA256SUMS`에서 체크섬을 확인할 수 있습니다. 서명·공증되지 않은 빌드는 OS 보안 확인이 나타날 수 있습니다.

[한국어 사용 안내](https://github.com/choimagon/PXagent#readme) · [English guide](https://github.com/choimagon/PXagent/blob/main/README.en.md)
