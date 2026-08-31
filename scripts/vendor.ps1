$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Vendor = Join-Path $Root "vendor"
New-Item -ItemType Directory -Force -Path $Vendor | Out-Null

$repos = @(
  @{ dir = "frontstage"; url = "https://github.com/x777/frontstage.git" },
  @{ dir = "openchatcut"; url = "https://github.com/0xsline/OpenChatCut.git" },
  @{ dir = "webav"; url = "https://github.com/WebAV-Tech/WebAV.git" }
)

foreach ($r in $repos) {
  $dest = Join-Path $Vendor $r.dir
  if (Test-Path (Join-Path $dest ".git")) {
    Write-Host "vendor/$($r.dir) already cloned"
    git -C $dest fetch --depth 1 origin
  } else {
    Write-Host "cloning $($r.url)"
    git clone --depth 1 $r.url $dest
  }
}

Write-Host "Vendor remotes:"
foreach ($r in $repos) {
  git -C (Join-Path $Vendor $r.dir) remote -v
  git -C (Join-Path $Vendor $r.dir) rev-parse --short HEAD
}
