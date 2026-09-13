<p align="center"><img src="public/assets/favicon.svg" width="96" alt="PXagents logo"></p>
<h1 align="center">PXagents</h1>
<p align="center">A pixel agent office powered by your own Codex account</p>
<p align="center"><a href="README.md">한국어</a> · <b>English</b> · <a href="https://github.com/choimagon/PXagent/releases/latest">Downloads</a></p>

![PXagents office demo](demo_img.png)

Assign work to Homunculus and let development, writing, and formatting agents collaborate. Ask secretary Pigeon about progress and read results in the mailbox. Each local or Tailscale computer has its own office.

## Install or uninstall

The download links below always point to the latest release. The current release is [v1.0.2](https://github.com/choimagon/PXagent/releases/tag/v1.0.2).

| OS | x64 / Intel | ARM64 / Apple Silicon |
| --- | --- | --- |
| Windows | [x64 (.exe)](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-x64.exe) | [ARM64 (.exe)](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-arm64.exe) |
| macOS | [x64 (.zip)](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-mac-x64.zip) | [ARM64 (.zip)](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-mac-arm64.zip) |
| Linux | [x64 (.tar.gz)](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-linux-x64.tar.gz) | [ARM64 (.tar.gz)](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-linux-arm64.tar.gz) |

**Windows**: download the [x64 installer](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-x64.exe) or [ARM64 installer](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-arm64.exe). Run it, enter **`i` to install** or **`c` to uninstall**, and click Next. Launch PXagents from your desktop or Start menu. You can also uninstall from Windows Settings.

**macOS / Linux**: paste this into a terminal and select **`i` to install / `c` to uninstall**. The script detects your OS and CPU.

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh | sh
```

Or download the script first:

```sh
curl -fLO https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh
sh install.sh
```

The app appears in your user Applications folder on macOS or application menu on Linux. Uninstalling retains saved tasks and account data. To update, run the installer again and select `i`. Close the app before updating or uninstalling.

Initial builds are unsigned; Windows SmartScreen or macOS may show a security prompt. Linux needs desktop libraries such as GTK/NSS and a working Chromium sandbox. On systems restricting user namespaces, such as Ubuntu 24.04, use the [`.deb` release package](https://github.com/choimagon/PXagent/releases/latest).

## First launch

1. Open the app and click **Codex 연결** (Connect Codex).
2. Sign in to **your own ChatGPT account** in your browser.
3. Check Tailscale connectivity, or skip it for local tasks.
4. Select a computer and click **일 시키기** (Assign work).

The app includes Codex; no separate Node.js or Codex CLI installation is needed. Your account must have Codex access and its usage limits apply. [Install and sign in to Tailscale separately](https://tailscale.com/download). The application interface is currently Korean.

## Features

- Rename every agent and the secretary with automatic saving: click a character or nameplate and edit **이름** (Name)
- Per-agent models and reasoning levels, Goal tasks, and task continuation
- Separate offices for each computer, automatic Tailscale discovery, saved SSH settings
- Results and alerts in the mailbox; progress questions through secretary Pigeon
- **tail웹**: publish task results as websites shared within your Tailscale network, with clickable links in result letters

Codex runs only on the computer hosting the app. Remote tasks use SSH terminals over Tailscale. Remote targets currently support Unix systems such as Linux and macOS and need SSH access configured. Windows can host the app and assign work to Unix computers. Desktop SSH passwords are encrypted using the OS secure storage facility.

## Asset sources and licenses

The external font and sound effect are free to use, including commercially. Sources and conditions are listed below.

| Asset | Source | License and conditions |
| --- | --- | --- |
| Pixel characters, office, furniture, and logo | SVG artwork created directly in project code ([characters](public/sprites.js), [office and furniture](public/office.js), [logo](public/assets/favicon.svg)) | No external game sprites or paid asset packs are used. A separate reuse license has not been selected. |
| Galmuri11 font | [Galmuri — Lee Minseo (quiple)](https://github.com/quiple/galmuri) | SIL Open Font License 1.1. Free commercial use and distribution bundled with the app are permitted. Retain the copyright notice and [license file](public/assets/Galmuri-LICENSE.md) when distributing it. The font cannot be sold by itself. |
| Keyboard typing sound effect | [Keyboard Typing 7 (HHKB, Topre) — grcekh](https://freesound.org/people/grcekh/sounds/546164/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Free commercial use, modification, and redistribution are permitted; attribution is not required. The project includes a [source record](public/assets/keyboard-typing-CREDITS.md). |

External asset licenses do not grant reuse rights for the application itself or its original artwork. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for all third-party notices.

## Development and releases

Requires Node.js 22.9 or newer.

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

Pushing a `v*` tag builds and verifies Windows, macOS, and Linux installers for x64 and ARM64, then publishes a GitHub release. The shell installer checks SHA-256 hashes. See [DISTRIBUTION.md](DISTRIBUTION.md) for build and signing configuration (Korean).

Releases exclude personal data, Codex login files, and SSH passwords. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for third-party licenses. A separate open-source license for the application has not been selected.
