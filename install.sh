#!/bin/sh
set -eu

INSTALL_ROOT="${PITCREW_INSTALL_ROOT:-$HOME/PitCrew}"
SOURCE_ROOT="${PITCREW_SOURCE:-$INSTALL_ROOT/source}"
CLI_ROOT="$INSTALL_ROOT/cli"
BIN_ROOT="$INSTALL_ROOT/bin"

for command in node npm git pnpm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing $command. Install Node.js 22.13+, Git, and pnpm 11.19.0." >&2
    exit 1
  fi
done

node -e "const v=process.versions.node.split('.').map(Number); if (v[0] < 22 || (v[0] === 22 && v[1] < 13)) process.exit(1)" ||
  { echo 'Node.js 22.13 or newer is required.' >&2; exit 1; }

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

mkdir -p "$CLI_ROOT" "$BIN_ROOT"
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
echo 'Open a new terminal, then run: pitcrew app'
echo 'No system-wide install or admin rights were used.'
