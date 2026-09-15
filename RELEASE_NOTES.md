# PXagents 2.1.3

## 이번 버전

- Windows 업데이트 설치 경로와 설치 후 버전 검증을 수정하고, 실패한 업데이트를 다시 시도할 수 있도록 개선했습니다.
- Codex 사용자 스킬과 플러그인 설정을 불러오며, 역할별 기본·선택 스킬을 작업에 전달합니다.
- Fast 모드와 분석·추론·검수 중에도 키보드 소리가 이어지도록 수정했습니다.
- 작업 격리와 원본 반영 단계를 제거했습니다. 에이전트는 지정한 실제 폴더와 요청한 외부 파일을 직접 수정합니다.
- 앱의 Codex 실행은 전체 파일 접근 권한으로 동작합니다. 수정은 즉시 적용되며, 검증 실패 시 자동으로 되돌리지 않습니다.
- 지원하지 않는 계획 스킬 이름 때문에 문서 작업 전체가 실패하는 문제와 분석 대상 폴더 검증을 수정했습니다.
- ‘논문부서’를 ‘문서 부서’로 변경하고 기존 사무실 설정과 UI에 적용했습니다.
- 비둘기 화면에서 추론 레벨과 질문 버튼 사이의 작업 로그·안내 문구를 제거했습니다.

## 설치

기존 앱의 업데이트 버튼 또는 아래 설치파일을 이용하세요. 실행 중인 작업을 마친 뒤 앱을 완전히 종료하고 다시 실행하면 적용됩니다. 기존 계정, 설정과 작업 기록은 유지합니다.

| OS | x64 | ARM64 |
| --- | --- | --- |
| Windows | `PXagents-windows-x64.exe` | `PXagents-windows-arm64.exe` |
| macOS | `PXagents-mac-x64.zip` | `PXagents-mac-arm64.zip` |
| Linux | `PXagents-linux-x64.tar.gz` | `PXagents-linux-arm64.tar.gz` |

macOS DMG와 Linux DEB/AppImage도 함께 제공합니다. 설치파일 체크섬은 `SHA256SUMS`에서 확인할 수 있습니다.

[한국어 사용 안내](https://github.com/choimagon/PXagent#readme) · [English guide](https://github.com/choimagon/PXagent/blob/main/README.en.md)
