# Login. I fork.

GitHub token on this machine is invalid (`MrZeku` keyring). You only log in. This repo then forks the engines under your account and publishes Cutlab.

```powershell
cd C:\Users\mrzek\cutlab
gh auth login -h github.com -p https -w
.\scripts\login-and-fork.ps1
```

That script will:

1. Finish `gh auth login` if needed
2. `gh repo create cutlab --public --source=. --push`
3. Fork:
   - `x777/frontstage` (timeline + **ffmpeg** MP4 + Whisper agent) → GPL-3
   - `0xsline/OpenChatCut` (chat + **Remotion** MP4 + GLSL shaders) → AGPL
   - `WebAV-Tech/WebAV` (browser WebCodecs Combinator MP4) → MIT
4. Point `vendor/*` remotes at **your** forks, keep `upstream` as the originals

Vendor trees stay local (gitignored). They are too large to dump into the MIT Cutlab repo.

## After login, tell the agent

Paste `gh auth status` (redact the token). The agent will run `scripts/login-and-fork.ps1` if you have not.

## Licenses

| Tree | License | Rule |
|---|---|---|
| Cutlab site + `packages/pipeline` + `packages/motion` | MIT | Ours |
| `vendor/frontstage` | GPL-3 | Keep GPL. Do not copy into MIT and relicense. |
| `vendor/openchatcut` | AGPL | Shaders / Remotion renderer stay AGPL. |
| `vendor/webav` | MIT | Safe to use in browser export. |
