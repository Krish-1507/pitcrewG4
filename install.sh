#!/bin/sh
set -eu

INSTALL_ROOT="${PITCREW_INSTALL_ROOT:-$HOME/PitCrew}"
SOURCE_ROOT="${PITCREW_SOURCE:-$INSTALL_ROOT/source}"
CLI_ROOT="$INSTALL_ROOT/cli"
BIN_ROOT="$INSTALL_ROOT/bin"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

for command in node npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing $command. Install Node.js 22.13+ (npm ships with it)." >&2
    exit 1
  fi
done

node -e "const v=process.versions.node.split('.').map(Number); if (v[0] < 22 || (v[0] === 22 && v[1] < 13)) process.exit(1)" ||
  { echo 'Node.js 22.13 or newer is required.' >&2; exit 1; }

# Fast path: install a prebuilt tarball directly. Only Node and npm are
# needed; Git and pnpm are required solely for the source-build fallback.
TARBALL="${PITCREW_TARBALL:-}"
if [ -n "$TARBALL" ]; then
  if [ ! -f "$TARBALL" ]; then
    echo "Tarball not found: $TARBALL" >&2
    exit 1
  fi
else
  TARBALL="$(ls -t "$SCRIPT_DIR"/pitcrew-cli-*.tgz "$SCRIPT_DIR"/release/pitcrew-cli-*.tgz 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$TARBALL" ]; then
  for command in git pnpm; do
    if ! command -v "$command" >/dev/null 2>&1; then
      echo "Missing $command. Install it, or place a pitcrew-cli-*.tgz next to this installer for the prebuilt fast path." >&2
      exit 1
    fi
  done
  mkdir -p "$INSTALL_ROOT"

  if [ ! -d "$SOURCE_ROOT" ]; then
    echo "Cloning PitCrew into $SOURCE_ROOT"
    git clone --depth 1 https://github.com/Krish-1507/pitcrewG4.git "$SOURCE_ROOT"
  elif [ ! -f "$SOURCE_ROOT/pnpm-lock.yaml" ]; then
    echo "$SOURCE_ROOT is not a PitCrew source checkout." >&2
    exit 1
  fi

  echo 'Installing dependencies and building PitCrew...'
  pnpm --dir "$SOURCE_ROOT" install --frozen-lockfile
  pnpm --dir "$SOURCE_ROOT" build
  pnpm --dir "$SOURCE_ROOT" package:cli

  TARBALL="$(ls -t "$SOURCE_ROOT"/release/pitcrew-cli-*.tgz 2>/dev/null | head -n 1 || true)"
  if [ -z "$TARBALL" ]; then
    echo 'Packaged CLI tarball was not produced.' >&2
    exit 1
  fi
else
  echo "Using the prebuilt CLI package: $TARBALL"
fi

mkdir -p "$INSTALL_ROOT" "$CLI_ROOT" "$BIN_ROOT"
echo "Installing the PitCrew CLI into $CLI_ROOT"
npm install -g --prefix "$CLI_ROOT" "$TARBALL"

PITCREW_BIN="$CLI_ROOT/bin/pitcrew"
if [ ! -x "$PITCREW_BIN" ]; then
  PITCREW_BIN="$CLI_ROOT/pitcrew"
fi
if [ ! -x "$PITCREW_BIN" ]; then
  echo 'Could not locate the installed pitcrew executable.' >&2
  exit 1
fi

cat > "$BIN_ROOT/pitcrew-desktop" <<EOF
#!/bin/sh
exec "$PITCREW_BIN" app --repo "\${1:-\$HOME}"
EOF
chmod +x "$BIN_ROOT/pitcrew-desktop"

cat > "$BIN_ROOT/pitcrew-quick" <<EOF
#!/bin/sh
exec "$PITCREW_BIN" app --quick --repo "\$HOME"
EOF
chmod +x "$BIN_ROOT/pitcrew-quick"

add_path_line() {
  file="$1"
  [ -f "$file" ] || return 0
  if ! grep -F "$BIN_ROOT" "$file" >/dev/null 2>&1; then
    printf '\nexport PATH="%s:%s:$PATH" # PitCrew\n' "$CLI_ROOT/bin" "$BIN_ROOT" >> "$file"
  fi
}
add_path_line "$HOME/.profile"
add_path_line "$HOME/.bashrc"
add_path_line "$HOME/.zshrc"

if [ "$(uname -s 2>/dev/null || true)" = 'Linux' ]; then
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/pitcrew.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=PitCrew
Comment=Local-first AI software engineering orchestration
Exec=$BIN_ROOT/pitcrew-desktop
Terminal=true
Categories=Development;
Actions=Quick;

[Desktop Action Quick]
Name=Quick Assistant
Exec=$BIN_ROOT/pitcrew-quick
EOF
fi

CONFIG_HOME="${PITCREW_HOME:-$HOME/.pitcrew}"
if [ ! -f "$CONFIG_HOME/config.json" ]; then
  echo 'Running first-time setup...'
  "$PITCREW_BIN" setup
fi

echo ''
echo "PitCrew installed under $INSTALL_ROOT"
echo "CLI:     $PITCREW_BIN"
echo "Desktop: $BIN_ROOT/pitcrew-desktop"
echo "Quick:   $BIN_ROOT/pitcrew-quick"
echo 'Open a new terminal, then run: pitcrew app'
echo 'Bind your desktop environment hotkey to pitcrew-quick for a global Quick Assistant.'
echo 'No system-wide install or admin rights were used.'
