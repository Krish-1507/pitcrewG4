param(
  [string]$InstallRoot = (Join-Path $env:USERPROFILE 'PitCrew'),
  [string]$Source = '',
  [string]$Tarball = '',
  [switch]$SkipPath,
  [switch]$NoShortcut,
  [switch]$NoSetup
)

$ErrorActionPreference = 'Stop'

function Require-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $Hint"
  }
}

Require-Command 'node' 'Install Node.js 22.13 or newer.'
Require-Command 'npm' 'npm ships with Node.js.'

$nodeVersion = [version](& node -p 'process.versions.node')
if ($nodeVersion -lt [version]'22.13.0') {
  throw "Node.js 22.13 or newer is required (found $nodeVersion)."
}

$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$NpmPrefix = Join-Path $InstallRoot 'cli'
$BinRoot = Join-Path $InstallRoot 'bin'
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

# Fast path: install a prebuilt tarball directly. Only Node and npm are
# needed; Git and pnpm are required solely for the source-build fallback.
$tarballPath = $null
if ($Tarball) {
  $tarballPath = [System.IO.Path]::GetFullPath($Tarball)
  if (-not (Test-Path -LiteralPath $tarballPath)) { throw "Tarball not found: $tarballPath" }
} else {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $tarballPath = Get-ChildItem -LiteralPath $scriptDir -Filter 'pitcrew-cli-*.tgz' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime | Select-Object -Last 1
  if (-not $tarballPath) {
    $tarballPath = Get-ChildItem -LiteralPath (Join-Path $scriptDir 'release') -Filter 'pitcrew-cli-*.tgz' -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime | Select-Object -Last 1
  }
  if ($tarballPath) { $tarballPath = $tarballPath.FullName }
}

if ($tarballPath) {
  Write-Host "Using the prebuilt CLI package: $tarballPath"
} else {
  Require-Command 'git' 'Install Git, or place a pitcrew-cli-*.tgz next to this installer for the prebuilt fast path.'
  Require-Command 'pnpm' 'Install pnpm 11.19.0, or place a pitcrew-cli-*.tgz next to this installer for the prebuilt fast path.'
  $SourceRoot = if ($Source) {
    [System.IO.Path]::GetFullPath($Source)
  } else {
    Join-Path $InstallRoot 'source'
  }
  if (-not (Test-Path -LiteralPath $SourceRoot)) {
    Write-Host "Cloning PitCrew into $SourceRoot"
    & git clone --depth 1 https://github.com/Krish-1507/pitcrewG4.git $SourceRoot
    if ($LASTEXITCODE -ne 0) { throw 'git clone failed.' }
  } elseif (-not (Test-Path -LiteralPath (Join-Path $SourceRoot 'pnpm-lock.yaml'))) {
    throw "$SourceRoot is not a PitCrew source checkout."
  }

  Write-Host 'Installing dependencies and building PitCrew...'
  & pnpm --dir $SourceRoot install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed.' }
  & pnpm --dir $SourceRoot build
  if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed.' }
  & pnpm --dir $SourceRoot package:cli
  if ($LASTEXITCODE -ne 0) { throw 'CLI packaging failed.' }

  $tarballPath = (Get-ChildItem -LiteralPath (Join-Path $SourceRoot 'release') -Filter 'pitcrew-cli-*.tgz' |
    Sort-Object LastWriteTime | Select-Object -Last 1).FullName
  if (-not $tarballPath) { throw 'Packaged CLI tarball was not produced.' }
}

New-Item -ItemType Directory -Force -Path $NpmPrefix, $BinRoot | Out-Null
Write-Host "Installing the PitCrew CLI into $NpmPrefix"
& npm install -g --prefix $NpmPrefix $tarballPath
if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

$launcher = Join-Path $BinRoot 'pitcrew-desktop.cmd'
$launcherBody = @"
@echo off
setlocal
set "REPO=%~1"
if "%REPO%"=="" set "REPO=%USERPROFILE%"
"$NpmPrefix\pitcrew.cmd" app --repo "%REPO%"
"@
Set-Content -LiteralPath $launcher -Value $launcherBody -Encoding ASCII

$quickLauncher = Join-Path $BinRoot 'pitcrew-quick.cmd'
$quickLauncherBody = @"
@echo off
setlocal
"$NpmPrefix\pitcrew.cmd" app --quick --repo "%USERPROFILE%"
"@
Set-Content -LiteralPath $quickLauncher -Value $quickLauncherBody -Encoding ASCII

if (-not $SkipPath) {
  $current = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @($current -split ';' | Where-Object { $_ })
  foreach ($entry in @($NpmPrefix, $BinRoot)) {
    if ($parts -notcontains $entry) { $parts += $entry }
  }
  [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
  $env:Path = "$NpmPrefix;$BinRoot;$env:Path"
}

if (-not $NoShortcut) {
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\PitCrew.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($startMenu)
  $shortcut.TargetPath = $launcher
  $shortcut.WorkingDirectory = $env:USERPROFILE
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
  $shortcut.Save()

  $quickShortcutPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\PitCrew Quick Assistant.lnk'
  try {
    $quickShortcut = $shell.CreateShortcut($quickShortcutPath)
    $quickShortcut.TargetPath = $quickLauncher
    $quickShortcut.WorkingDirectory = $env:USERPROFILE
    $quickShortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
    $quickShortcut.WindowStyle = 7
    $quickShortcut.Hotkey = 'CTRL+ALT+P'
    $quickShortcut.Save()
  } catch {
    Write-Warning 'Could not register Ctrl+Alt+P. Create a shortcut to pitcrew-quick.cmd manually.'
  }
}

if (-not $NoSetup) {
  $configHome = if ($env:PITCREW_HOME) { $env:PITCREW_HOME } else { Join-Path $env:USERPROFILE '.pitcrew' }
  $configPath = Join-Path $configHome 'config.json'
  if (-not (Test-Path -LiteralPath $configPath)) {
    Write-Host 'Running first-time setup...'
    & (Join-Path $NpmPrefix 'pitcrew.cmd') setup
    if ($LASTEXITCODE -ne 0) { throw 'PitCrew setup failed.' }
  }
}

Write-Host ''
Write-Host "PitCrew installed under $InstallRoot"
Write-Host "CLI:     $(Join-Path $NpmPrefix 'pitcrew.cmd')"
Write-Host "Desktop: $launcher"
Write-Host "Quick:   $quickLauncher"
Write-Host 'Open a new terminal, then run: pitcrew app'
if (-not $NoShortcut) {
  Write-Host 'Start Menu shortcuts: PitCrew and PitCrew Quick Assistant'
  Write-Host 'Global hotkey: Ctrl+Alt+P opens the Quick Assistant'
}
Write-Host 'Nothing was installed system-wide and no admin rights were used.'
