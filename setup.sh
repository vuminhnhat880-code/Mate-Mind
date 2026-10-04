#!/usr/bin/env bash
set -euo pipefail

MODEL="qwen3:1.7b"
OLLAMA_URL="http://127.0.0.1:11434/api/tags"
OS="$(uname -s)"

cd "$(dirname "$0")"

install_node() {
  case "$OS" in
    Darwin)
      if ! command -v brew >/dev/null 2>&1; then
        printf 'Installing Homebrew...\n'
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        if [[ -x /opt/homebrew/bin/brew ]]; then
          eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -x /usr/local/bin/brew ]]; then
          eval "$(/usr/local/bin/brew shellenv)"
        else
          printf 'Homebrew was installed. Open a new terminal and rerun this script.\n' >&2
          exit 1
        fi
      fi
      brew install node
      ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
      elif command -v dnf >/dev/null 2>&1; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
        sudo dnf install -y nodejs
      elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -Sy --noconfirm nodejs npm
      else
        printf 'Could not detect apt, dnf, or pacman. Install Node.js 22.13+ and npm, then rerun.\n' >&2
        exit 1
      fi
      ;;
    *)
      printf 'Unsupported operating system: %s\n' "$OS" >&2
      exit 1
      ;;
  esac
}

install_ollama() {
  case "$OS" in
    Darwin)
      brew install ollama
      ;;
    Linux)
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
  esac
}

node_is_supported() {
  command -v node >/dev/null 2>&1 && node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)'
}

if ! node_is_supported; then
  printf 'Installing Node.js and npm...\n'
  install_node
fi

if ! node_is_supported; then
  printf 'Node.js 22.13+ is required. Install a current LTS release from https://nodejs.org/ and rerun this script.\n' >&2
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  printf 'Installing Ollama...\n'
  install_ollama
fi

if ! command -v npm >/dev/null 2>&1; then
  printf 'npm was not found. Install Node.js 22.13+ with npm, then rerun this script.\n' >&2
  exit 1
fi

printf '\nInstalling project dependencies...\n'
npm ci

if ! curl -fsS "$OLLAMA_URL" >/dev/null 2>&1; then
  printf '\nStarting Ollama in the background...\n'
  nohup ollama serve >/tmp/chesschat-ollama.log 2>&1 </dev/null &
  for attempt in {1..60}; do
    if curl -fsS "$OLLAMA_URL" >/dev/null 2>&1; then
      break
    fi
    if [[ "$attempt" -eq 60 ]]; then
      printf 'Ollama did not become ready. Start it with `ollama serve`, then rerun this script.\n' >&2
      exit 1
    fi
    sleep 1
  done
fi

printf '\nDownloading Ollama model %s (about 1.4 GB)...\n' "$MODEL"
ollama pull "$MODEL"

printf '\nBuilding ChessChat...\n'
npm run build

printf '\nSetup complete. Starting ChessChat at http://localhost:5173\n'
npm run dev -- --host 127.0.0.1