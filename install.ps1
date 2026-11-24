param(
  [string]$InstallRoot = (Join-Path $env:USERPROFILE 'PitCrew'),
  [string]$Source = '',
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
Require-Command 'git' 'Install Git and retry.'
Require-Command 'pnpm' 'Install pnpm 11.19.0 (corepack is not assumed).'

$nodeVersion = [version](& node -p 'process.versions.node')
if ($nodeVersion -lt [version]'22.13.0') {
  throw "Node.js 22.13 or newer is required (found $nodeVersion)."
}

$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$SourceRoot = if ($Source) {
  [System.IO.Path]::GetFullPath($Source)
} else {
  Join-Path $InstallRoot 'source'
}
$NpmPrefix = Join-Path $InstallRoot 'cli'
$BinRoot = Join-Path $InstallRoot 'bin'
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

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

$tarball = Get-ChildItem -LiteralPath (Join-Path $SourceRoot 'release') -Filter 'pitcrew-cli-*.tgz' |
  Sort-Object LastWriteTime |
  Select-Object -Last 1
if (-not $tarball) { throw 'Packaged CLI tarball was not produced.' }

New-Item -ItemType Directory -Force -Path $NpmPrefix, $BinRoot | Out-Null
Write-Host "Installing the PitCrew CLI into $NpmPrefix"
& npm install -g --prefix $NpmPrefix $tarball.FullName
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
Write-Host 'Open a new terminal, then run: pitcrew app'
if (-not $NoShortcut) { Write-Host 'Start Menu shortcut: PitCrew' }
Write-Host 'Nothing was installed system-wide and no admin rights were used.'
