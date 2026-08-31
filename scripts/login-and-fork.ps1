# You log in. Cutlab forks the engines and publishes this repo.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== GitHub login ==="
gh auth status -h github.com
if ($LASTEXITCODE -ne 0) {
  Write-Host "Browser login. Complete it, then this script continues."
  gh auth login -h github.com -p https -w
  if ($LASTEXITCODE -ne 0) { throw "gh auth login failed" }
}

$user = (gh api user --jq .login).Trim()
if (-not $user) { throw "Could not read GitHub login" }
Write-Host "Logged in as $user"

$desc = "Open-source AI video editor: HyperFrames + Remotion + FFmpeg. Auto captions, viral highlights, real MP4."
$existing = gh repo view "$user/cutlab" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating $user/cutlab"
  gh repo create cutlab --public --source=. --remote=origin --description $desc --push
} else {
  Write-Host "Repo $user/cutlab already exists"
  $origin = git remote get-url origin 2>$null
  if (-not $origin) {
    git remote add origin "https://github.com/$user/cutlab.git"
  }
  git push -u origin HEAD
}

$forks = @(
  @{ up = "x777/frontstage"; name = "frontstage"; vendor = "frontstage" },
  @{ up = "0xsline/OpenChatCut"; name = "OpenChatCut"; vendor = "openchatcut" },
  @{ up = "WebAV-Tech/WebAV"; name = "WebAV"; vendor = "webav" }
)

foreach ($f in $forks) {
  Write-Host "Forking $($f.up) -> $user/$($f.name)"
  gh repo fork $f.up --clone=false --default-branch-only
  $dest = Join-Path $Root "vendor\$($f.vendor)"
  if (Test-Path (Join-Path $dest ".git")) {
    git -C $dest remote remove origin 2>$null
    git -C $dest remote add origin "https://github.com/$user/$($f.name).git"
    git -C $dest remote remove upstream 2>$null
    git -C $dest remote add upstream "https://github.com/$($f.up).git"
    Write-Host "  vendor/$($f.vendor) origin=$user/$($f.name) upstream=$($f.up)"
  }
}

@"
# Forks (generated)

- Cutlab: https://github.com/$user/cutlab
- Frontstage (GPL-3): https://github.com/$user/frontstage  (upstream x777/frontstage)
- OpenChatCut (AGPL): https://github.com/$user/OpenChatCut  (upstream 0xsline/OpenChatCut)
- WebAV (MIT): https://github.com/$user/WebAV  (upstream WebAV-Tech/WebAV)

Do not relicense the GPL/AGPL trees as MIT.
"@ | Set-Content -Encoding utf8 (Join-Path $Root "FORKS.local.md")

Write-Host "Done. See FORKS.local.md"
gh repo list $user --limit 12
