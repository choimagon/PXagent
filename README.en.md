<p align="center"><img src="public/assets/favicon.svg" width="88" alt="PXagents logo"></p>
<h1 align="center">PXagents 2.1</h1>
<p align="center"><b>A pixel multi-agent office powered by your ChatGPT subscription</b></p>
<p align="center">
  <a href="https://github.com/choimagon/PXagent/releases/latest"><img src="https://img.shields.io/badge/version-2.1.1-91b77a?style=flat-square" alt="Version 2.1.1"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-546b49?style=flat-square" alt="Windows, macOS, Linux">
  <img src="https://img.shields.io/badge/CPU-x64%20%C2%B7%20ARM64-546b49?style=flat-square" alt="x64, ARM64">
</p>
<p align="center"><a href="README.md">한국어</a> · <b>English</b> · <a href="https://github.com/choimagon/PXagent/releases/latest">Download installers</a> · <a href="#installation">Install</a> · <a href="#uninstallation">Uninstall</a> · <a href="#features">Features</a></p>

![PXagents 2.1 pixel office — demo mode](demo_img.png)

**PXagents turns Codex into a multi-agent desktop workflow using your OpenAI ChatGPT subscription.** A lead agent assigns requests to development, writing, and editing specialists, each with its own model and instructions. Sign in with your own ChatGPT account to use subscription-based Codex without entering an API key.

Assign work, watch your pixel coworkers, ask the secretary about progress, and read their reports in the mailbox. The screenshot shows **demo mode**, not evidence of a real AI execution. The application interface is currently Korean.

## Requirements

| Scope | What you need |
| --- | --- |
| Every OS | Your own ChatGPT subscription with Codex access, internet access, and a browser for sign-in |
| Included in the app | Electron/Node.js runtime, official Codex CLI and platform resources; no separate installation needed |
| Remote work | [Tailscale](https://tailscale.com/download) on both computers, an SSH client on the app host, and an SSH server on the target |
| Task tools | Python, Git, compilers, or other tools on the task computer when required by your request |

Local work does not require Tailscale or SSH. Model availability and subscription limits follow OpenAI policy. [Official Codex pricing](https://developers.openai.com/codex/pricing)

## Installation

### Windows — use the EXE installer

Open **Settings → System → About → System type** to identify your processor.

| Computer | Installer |
| --- | --- |
| Intel/AMD 64-bit PC; “x64-based processor” | [PXagents-windows-x64.exe](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-x64.exe) |
| Windows on ARM, such as Snapdragon; “ARM-based processor” | [PXagents-windows-arm64.exe](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-windows-arm64.exe) |

1. Download and run the matching `.exe`.
2. Keep **`i`** on the first screen and click **Next**.
3. Choose an installation location and launch PXagents from your Start menu or desktop.

There is no 32-bit installer. Node.js, npm, and Codex CLI do not need to be installed separately.

**For remote work:** install and sign in to Tailscale. If OpenSSH Client is missing, install it from an **administrator PowerShell** session. [Microsoft instructions](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

### macOS — install from Terminal

The script detects Intel Macs as x64 and Apple Silicon Macs as ARM64.

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh i
open "$HOME/Applications/PXagents.app"
```

The app is installed to `~/Applications/PXagents.app`. It uses macOS tools such as `curl`, `sh`, `ditto`, and `shasum`; Homebrew and separate Node.js packages are not required. For remote work, install Tailscale and use the built-in SSH client.

Manual downloads: [Apple Silicon ZIP](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-mac-arm64.zip) / [Intel ZIP](https://github.com/choimagon/PXagent/releases/latest/download/PXagents-mac-x64.zip). DMG installers are also available on the [release page](https://github.com/choimagon/PXagent/releases/latest).

### Linux — install runtime dependencies, then use the script

A graphical desktop session is required. The installer detects x86_64/amd64 as x64 and aarch64/arm64 as ARM64. You need GTK, NSS, GBM, and ALSA runtimes, certificates, and download/archive tools. To save SSH passwords, run **GNOME Keyring or KWallet with Secret Service support**.

**Ubuntu 24.04:**

```sh
sudo apt-get update
sudo apt-get install -y curl ca-certificates tar coreutils libgtk-3-0 libnss3 libgbm1 libasound2t64 libsecret-1-0 gnome-keyring
```

**Ubuntu 22.04:**

```sh
sudo apt-get update
sudo apt-get install -y curl ca-certificates tar coreutils libgtk-3-0 libnss3 libgbm1 libasound2 libsecret-1-0 gnome-keyring
```

Use equivalent runtime packages on other distributions. For remote work, also install `openssh-client` and Tailscale.

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh i
"$HOME/.local/bin/pxagents"
```

The app is installed to `~/.local/opt/pxagents` and registered in your application menu. TAR installs use Chromium's unprivileged user namespace sandbox. If your system restricts it, as some Ubuntu 24.04 configurations do, download the matching `.deb` from Releases and install it:

```sh
# Run in the directory containing your downloaded package
sudo apt install ./PXagents-2.1.1-linux-x64.deb
# On ARM64, use this instead:
# sudo apt install ./PXagents-2.1.1-linux-arm64.deb
```

AppImage users may also need a FUSE 2 runtime. [All Linux downloads](https://github.com/choimagon/PXagent/releases/latest)

> The shell installer checks SHA-256 hashes. Unsigned or unnotarized releases may display Windows SmartScreen or macOS security prompts.

## Updates

Click **업데이트 (Update)** in the left sidebar to check the latest stable GitHub release. Download it, then choose **업데이트 후 재시작 (Update and restart)**. The app selects your OS and CPU, verifies SHA-256, and replaces the application while preserving accounts, agent settings, mail, and task history. Finish or stop running and queued tasks and Goals first.

For 2.1.0 or older, install 2.1.1 or newer over the existing app once to get the button; no uninstall is needed. Linux DEB updates require `pkexec` (PolicyKit) and administrator approval. If the application directory is not writable or PolicyKit is unavailable, use **설치파일 열기 (Open installer)** to install over the existing app. The web interface links to desktop downloads.

## Uninstallation

### Windows

Open **Settings → Apps → Installed apps → PXagents → Uninstall**. Alternatively, run the EXE installer again and enter **`c`** on its first screen.

### macOS

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh c
```

### Linux

Close the app. For a script installation:

```sh
curl -fsSL https://raw.githubusercontent.com/choimagon/PXagent/main/install.sh -o /tmp/pxagents-install.sh
sh /tmp/pxagents-install.sh c
```

For a `.deb` installation:

```sh
sudo apt remove px-agents-office
```

Uninstallation removes the app and its shortcuts, while **retaining saved work, mail, settings, and account data**. To clear records inside the app, use **🗑️ 비우기** (Empty) on each history screen.

## First launch

1. Click **Codex 연결** (Connect Codex) and sign in with your own ChatGPT account.
2. Choose **내 컴퓨터로 시작** for local work, or connect Tailscale and choose **컴퓨터 선택하기** for remote work.
3. Click **일 시키기** (Assign work), enter your request, and select a working directory.
4. Follow progress in the sidebar and read results in the mailbox.

Codex can execute commands and edit files for your request. The app's execution settings allow work without additional approval prompts.

## Features

### Nine coworkers with separate roles

| Department | Default name | Role |
| --- | --- | --- |
| Boss room | 호문클루스 / Homunculus | Interpret requests, assign workers, review results, and report |
| Boss room | 비둘기 / Pigeon | Explain progress using actual tasks and logs; separate from lead-controlled workers |
| Development | 개발노예 | Development, debugging, design, and junior review |
| Development | 따까리 | Small UI changes, simple fixes, and tests |
| Development | 카파시 | Repeated experiments delegated by the development lead |
| Documents | 분석이 | Read files; structure claims, evidence, tables, figures, equations, and limitations |
| Documents | 글싸게 | Drafting, writing, and research documents |
| Documents | 양식이 | Editing, document formatting, and reference organization |
| Miscellaneous | 말똥이 | Organization, ideas, and everyday work |

Click a character or nameplate to open its details; **작업 배정** (Assign task) appears at the top. Set role instructions and a fixed prompt per worker. The **pencil button beside the name** opens name and appearance settings. Choose from **26 pixel characters**, including wizards, robots, ninjas, cats, penguins, and more.

### Model and reasoning presets

The **🤖 button** in the office applies a whole team configuration. Save your current model and reasoning combination as a named **custom preset**, then reapply it later. Presets are stored separately for each office.

| Agent | Upper | Middle | Lower |
| --- | --- | --- | --- |
| Homunculus | Astra / High | Sol / XHigh | Terra / High |
| Development lead | Sol / High | Terra / XHigh | Terra / Medium |
| Writer | Sol / High | Terra / XHigh | Luna / XHigh |
| Formatter | Terra / High | Terra / Medium | Luna / XHigh |
| 분석이 | Terra / High | Terra / High | Luna / XHigh |
| 카파시 | Sol / High | Terra / High | Luna / XHigh |
| Junior, miscellaneous worker, secretary | Fixed Luna / Medium | Fixed Luna / Medium | Fixed Luna / Medium |

Other workers can be adjusted individually in the sidebar. Changes take effect on the next model call.

### Department Fast mode and visual changes

Toggle **Normal ↔ Fast** at the top right of a department. The saved setting applies to that department's next Codex call. Fast workers display pixel flames above their heads. The boss room gets a night window and scattered books; development gains cooling units, pipes, and a fan; writing gains book stacks; miscellaneous work gains parcels and a tilted display.

Fast mode uses more subscription quota in exchange for faster processing on supported models. See [OpenAI's official Fast mode guidance](https://developers.openai.com/codex/speed) for supported models and rates.

### Tasks, Goals, and progress

Pick a worker directly or let the lead delegate. **Goals** define an objective and completion criteria, review each result, and continue in further rounds. View states, execution stages, logs, and results; stop, retry, or continue earlier work. Each worker has a queue, while different workers can operate in parallel.

Ask the secretary what is happening to receive an answer based on real tasks and logs. The sidebar also shows subscription usage and reset-credit information when available.

### Planning, validation, and experiments

Homunculus decomposes requests into a dependency graph, runs independent specialists in parallel, and replans failed work. **분석이** reads and analyzes documents; **Writer** writes; **Formatter** preserves facts while arranging styles and submission formats. The document department retains its original Korean room label. The development lead chooses direct implementation, junior delegation, or the independent **카파시 AutoResearch** agent. Task-specific prompts load only allowed skills from the 21-entry registry.

Codex implementation uses isolated Git worktrees, or snapshots for non-Git projects. Actual diff/scope checks, JavaScript/Python syntax checks, and available project lint/test/integration/build scripts must pass before review and integration. Existing user changes remain intact. Select a real project directory; a non-Git home directory or filesystem root cannot be used for isolated implementation. Git and your project's runtime/dependencies are required for these checks. Demo and API text-only responses are visibly distinguished from actual execution.

AutoResearch runs in **local Git projects only**, with fixed executable tests and a measurement command that returns a final JSON line `{"metric": number}`. Better candidates are preserved; worse or failing changes are rolled back. Fixed test and measurement files cannot be edited to inflate results. Maximum limits are **5 iterations, 10 minutes, 20,000 reported tokens, and 10 changed files**; lower limits and validation commands can be set in the assignment dialog. Token usage is checked after each Codex turn, so one in-flight turn can exceed the budget; its changes are discarded. This is not a monetary billing cap. The developer reviews the best result before integration.

DOCX/PPTX text extraction needs Python 3. PDF extraction needs Poppler (`pdftotext`) or Python 3 with PyMuPDF/pypdf. Put the executables on PATH, including on Windows. PDF pages and embedded Word/PPT images can be extracted into a separate analysis cache for actual image-tool review. PDF rendering needs Poppler (`pdftoppm`) or PyMuPDF. Scanned PDFs need OCR; figures and equations require visual review. These limitations are included in analysis results. Remote SSH Git workspaces run serially; a fallback without Git records its isolation limitations. Remote AutoResearch is disabled because remote OS write boundaries cannot be enforced.

Persisted events drive pixel typing, testing, reviewing, document analysis, and experiment states. Task details expose dependencies, skills, actual validation records, hypotheses, metrics, and acceptance/discard history.

### Mailbox, logs, and cleanup

Completed, failed, and stopped tasks produce report letters. Mark them read, copy or download results, and receive a completion chime. Keyboard typing sounds accompany office work. Activity history shows agent stages and execution events.

Use **🗑️ 비우기** in the mailbox, task view, or activity history to choose **delete all** or **delete records before a date**. Confirm the number of records before deletion. Records on the selected day are kept. Task cleanup retains running/queued work and ongoing Goals. The three histories are cleared separately. Mail and tasks do not reset automatically; activity logs retain the most recent 1,000 entries.

### Computer offices and tailweb sharing

Discover Tailscale computers and manage separate offices, tasks, letters, and presets. Save connection accounts and SSH settings. **Codex runs on the app host**; remote files and commands are handled over SSH. Remote targets currently support Unix environments such as Linux and macOS.

Enable **tail웹** to publish a task result as a webpage and include its link in the report letter. It is accessible within your Tailscale network while the app is running. Desktop connection passwords are encrypted through OS secure storage.

## Assets and licenses

| Component | Source and terms |
| --- | --- |
| Pixel characters, office, furniture, logo, and flames | SVG artwork created in this project; no external game sprites or paid asset packs |
| Galmuri11 font | [Galmuri / quiple](https://github.com/quiple/galmuri) · [SIL OFL 1.1](public/assets/Galmuri-LICENSE.md) |
| Keyboard typing sound | [Keyboard Typing 7 / grcekh](https://freesound.org/people/grcekh/sounds/546164/) · [CC0 1.0](public/assets/keyboard-typing-CREDITS.md) |

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for third-party notices. A separate reuse license for the app and original artwork has not been selected. Releases do not include personal tasks, login files, or SSH passwords.
