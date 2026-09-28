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
        sudo apt-get install -y nodejs npm
      elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y nodejs npm
      elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -Sy --noconfirm nodejs npm
      else
        printf 'Could not detect apt, dnf, or pacman. Install Node.js 18+ and npm, then rerun.\n' >&2
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

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 18 ]]; then
  printf 'Installing Node.js and npm...\n'
  install_node
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 18 ]]; then
  printf 'Node.js 18+ is required. Install a current release from https://nodejs.org/ and rerun this script.\n' >&2
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  printf 'Installing Ollama...\n'
  install_ollama
fi

if ! command -v npm >/dev/null 2>&1; then
  printf 'npm was not found. Install Node.js 18+ with npm, then rerun this script.\n' >&2
  exit 1
fi

printf '\nInstalling project dependencies...\n'
npm ci

if ! curl -fsS "$OLLAMA_URL" >/dev/null 2>&1; then
  printf '\nStarting Ollama in the background...\n'
  nohup ollama serve >/tmp/stockbot-ollama.log 2>&1 </dev/null &
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

printf '\nBuilding Stockbot...\n'
npm run build

printf '\nSetup complete. Starting Stockbot at http://localhost:5173\n'
npm run dev -- --host 127.0.0.1