#Requires -Version 5.1
param(
  [ValidateSet("open", "boot-screenshot", "close")]
  [string]$Action = "boot-screenshot",
  [string]$Url = "http://localhost:5173",
  [string]$ShotDir = "$env:USERPROFILE\screenshots"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null

function Invoke-GameEval {
  param([string]$Js)
  corps-browser eval $Js
}

function Wait-ForPageReady {
  param([int]$MaxSeconds = 20)
  for ($i = 0; $i -lt $MaxSeconds; $i++) {
    $state = Invoke-GameEval "(function(){return document.querySelector('canvas')?'ready':'wait';})()"
    if ($state -match 'ready') { return $state }
    Start-Sleep -Seconds 1
  }
  throw "Page not ready after ${MaxSeconds}s at $Url"
}

switch ($Action) {
  "open" {
    corps-browser open $Url
    Wait-ForPageReady
  }
  "boot-screenshot" {
    corps-browser open $Url
    Wait-ForPageReady
    corps-browser screenshot (Join-Path $ShotDir "mepb-boot.png")
  }
  "close" {
    corps-browser close
  }
}
