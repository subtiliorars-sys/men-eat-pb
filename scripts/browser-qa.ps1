#Requires -Version 5.1
<#
.SYNOPSIS
  Canvas-aware browser QA for Men Eat Peanut Butter (corps-browser / agent-browser).

.EXAMPLE
  .\scripts\browser-qa.ps1 -Action boot-screenshot
  .\scripts\browser-qa.ps1 -Action click -Target chomp-man-0
  .\scripts\browser-qa.ps1 -Action tutorial-smoke
#>
param(
  [ValidateSet("open", "boot-screenshot", "click", "tutorial-smoke", "screenshot", "close")]
  [string]$Action = "boot-screenshot",
  [string]$Target = "start-run",
  [string]$Url = "",
  [string]$ShotDir = "$env:USERPROFILE\screenshots"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null

if (-not $Url) {
  foreach ($port in @(5173, 5174, 5175)) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { $Url = "http://localhost:$port"; break }
    } catch { }
  }
  if (-not $Url) { $Url = "http://localhost:5173" }
}

$clickMap = @{
  "start-run"    = @{ x = 400; y = 425 }
  "chomp-man-0"  = @{ x = 280; y = 250 }
  "chomp-man-1"  = @{ x = 520; y = 250 }
  "chomp-man-2"  = @{ x = 280; y = 310 }
  "chomp-man-3"  = @{ x = 520; y = 310 }
  "retry"        = @{ x = 490; y = 380 }
}

function Invoke-GameEval {
  param([string]$Js)
  corps-browser eval $Js
}

function Wait-ForPageReady {
  param([int]$MaxSeconds = 20)
  for ($i = 0; $i -lt $MaxSeconds; $i++) {
    $state = Invoke-GameEval "(function(){return (document.querySelector('canvas')&&window.__MEP_GAME__)?'ready':'wait';})()"
    if ($state -match 'ready') { return $state }
    Start-Sleep -Seconds 1
  }
  throw "Page not ready after ${MaxSeconds}s at $Url (last: $state)"
}

function Open-AndWait {
  corps-browser open $Url
  corps-browser wait --load networkidle 2>$null
  if ($LASTEXITCODE -ne 0) { corps-browser wait 8000 | Out-Null }
  try {
    Wait-ForPageReady -MaxSeconds 15 | Out-Null
  } catch {
    corps-browser open $Url
    corps-browser wait 8000 | Out-Null
    Wait-ForPageReady -MaxSeconds 15 | Out-Null
  }
}

function Get-QaFlags {
  Invoke-GameEval "(function(){var q=window.__MEP_QA__;return q&&q.flags()?JSON.stringify(q.flags()):'null';})()"
}

function Invoke-QaClick {
  param([string]$TargetKey)
  $r = Invoke-GameEval "(function(){var q=window.__MEP_QA__;return q?q.click('$TargetKey'):'no-qa';})()"
  if ($r -notmatch 'ok') { throw "QA click '$TargetKey' failed: $r" }
  return $r
}

function Test-QaFlagTrue {
  param([string]$Json, [string]$FlagName)
  return ($Json -like "*${FlagName}*true*")
}

function Invoke-CanvasClick {
  param([int]$GameX, [int]$GameY)
  $js = '(function(){var c=document.querySelector(''canvas'');if(!c)return ''no-canvas'';var r=c.getBoundingClientRect();var cx=r.left+(' + $GameX + '/800)*r.width;var cy=r.top+(' + $GameY + '/600)*r.height;var o={clientX:cx,clientY:cy,bubbles:true,cancelable:true,view:window,pointerId:1,pointerType:''mouse'',isPrimary:true};c.dispatchEvent(new PointerEvent(''pointerdown'',o));c.dispatchEvent(new PointerEvent(''pointerup'',o));return ''clicked-''+Math.round(cx)+'',''+Math.round(cy);})()'
  $r = Invoke-GameEval $js
  if ($r -match 'no-canvas') { throw "Canvas click failed: $r" }
  return $r
}

switch ($Action) {
  "open" {
    Open-AndWait
  }
  "boot-screenshot" {
    Open-AndWait
    corps-browser screenshot (Join-Path $ShotDir "mep-boot.png")
  }
  "click" {
    if (-not $clickMap.ContainsKey($Target)) {
      throw "Unknown target '$Target'. See docs/QA_CLICK_MAP.md"
    }
    Open-AndWait
    $pt = $clickMap[$Target]
    Invoke-CanvasClick -GameX $pt.x -GameY $pt.y | Out-Null
    Start-Sleep -Milliseconds 800
    $flags = Get-QaFlags
    Write-Output "QA_FLAGS: $flags"
    corps-browser screenshot (Join-Path $ShotDir "mep-after-$Target.png")
  }
  "tutorial-smoke" {
    Open-AndWait
    Start-Sleep -Seconds 1
    Invoke-QaClick -TargetKey "start-run" | Out-Null
    Start-Sleep -Milliseconds 600
    $afterStart = Get-QaFlags
    Write-Output "after start-run: $afterStart"
    if (-not (Test-QaFlagTrue -Json $afterStart -FlagName "running")) {
      throw "Smoke test FAIL: start-run did not start the game ($afterStart)"
    }
    Invoke-QaClick -TargetKey "chomp-man-0" | Out-Null
    Start-Sleep -Milliseconds 400
    $afterChomp = Get-QaFlags
    Write-Output "after chomp-man-0: $afterChomp"
    corps-browser screenshot (Join-Path $ShotDir "mep-smoke.png")
    Write-Output "TUTORIAL-SMOKE: PASS"
  }
  "screenshot" {
    corps-browser screenshot (Join-Path $ShotDir "mep-manual.png")
  }
  "close" {
    corps-browser close
  }
}
