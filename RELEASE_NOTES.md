# PXagents 2.0

ChatGPT 구독 기반 Codex를 역할별 에이전트로 구성한 픽셀 사무실입니다.

## 이번 버전

- 분석이·카파시 추가: 역할별 9개 에이전트와 기존 두 명 사이의 뒷줄 배치
- 의존성 기반 병렬 작업 그래프, 실패 작업 재계획 및 최종 검수
- 21개 스킬과 Git worktree 격리, 실제 구문·테스트·빌드 검증
- 개발 팀장 위임 AutoResearch: 실제 metric 비교, best 보존과 실패·성능 악화 rollback
- 분석이의 A~E·9항목 논문 리뷰, 글싸게의 영어·논리 교정, 양식이의 미국식 영어·그림·표 참조 점검
- 논문·일반 문서의 별도 템플릿 보존: 글꼴·크기·배치·색상·표·그림 서식 유지와 실제 출력 비교
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

Windows는 CPU에 맞는 EXE를 실행하고 설치 안내를 따릅니다. 삭제는 Windows 설정의 설치된 앱에서 PXagents를 제거합니다.

macOS·Linux 설치:

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh i
```

삭제는 마지막 줄을 `sh /tmp/pxagents-install.sh c`로 바꿉니다. 저장된 작업과 계정 정보는 유지합니다.

macOS DMG와 Linux DEB/AppImage도 함께 제공합니다. 릴리스의 `SHA256SUMS`에서 체크섬을 확인할 수 있습니다. 서명·공증되지 않은 빌드는 OS 보안 확인이 나타날 수 있습니다.

AutoResearch는 로컬 Git 프로젝트에서 실행하며 토큰 예산은 턴 종료 후 집계합니다. 문서 분석에는 형식에 따라 Python 3와 Poppler 또는 PDF Python 라이브러리가 필요합니다. 자세한 OS별 설치 안내는 README를 확인하세요.

[한국어 사용 안내](https://github.com/choimagon/PXagent#readme) · [English guide](https://github.com/choimagon/PXagent/blob/main/README.en.md)
