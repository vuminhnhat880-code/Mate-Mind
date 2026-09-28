# Stockbot

Stockbot is a browser-based chess analysis and coaching app powered by Stockfish 19 and a local Ollama chat model. It lets you play, analyze, import FEN/PGN positions, and inspect engine evaluations without sending data to a cloud service.

## Features

- Real chess logic using `chess.js`
- Stockfish 19 engine integration for live evaluation and best moves
- Analysis mode with principal variation arrow overlays
- FEN import and PGN import support
- Board interaction with drag-and-drop piece movement
- Local chat with Ollama using a lightweight model such as `qwen3:1.7b`
- Modern UI for board, moves, engine output, and chat

## Requirements

- macOS, Windows 10/11, or Linux
- Node.js 18+ and npm
- Ollama and the `qwen3:1.7b` model for chat

## Quick start

Clone or download this repository, open a terminal in the project folder, then run the setup script for your operating system.

### macOS and Linux

```bash
bash setup.sh
```

On macOS, the script uses Homebrew to install missing Node.js and Ollama. On Linux, it supports apt, dnf, or pacman for Node.js and uses Ollama's official installer. The script may request administrator permission to install system packages.

### Windows

Open PowerShell in the project folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

The Windows setup uses `winget` to install Node.js and Ollama if needed. If `winget` is unavailable, install or update **App Installer** from the Microsoft Store. If Windows asks for permission to run the script, approve it for this run.

Both scripts install npm dependencies, download the Ollama `qwen3:1.7b` model (about 1.4 GB), build the app, and start the development server at `http://localhost:5173`. Keep the terminal open while running the app; press `Ctrl+C` to stop it. Ensure you have an internet connection and sufficient disk space.

### Manual setup

Install Node.js 18+ and Ollama for your operating system, then run:

```sh
ollama serve
ollama pull qwen3:1.7b
npm ci
npm run dev
```

To create a production build, run `npm run build`. The generated files are in the `dist/` folder.

## Project structure

```text
Stockbot/
├── public/
│   └── engine/
│       ├── stockfish-19.js
│       └── COPYING.txt
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── ...
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── LICENSE
├── README.md
├── setup.sh
├── setup-windows.ps1
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── package-lock.json
```

## Engine attribution

This project integrates Stockfish 19 for chess analysis and move generation. The bundled engine in `public/engine/` is distributed under the GPL-3.0 license as indicated in `public/engine/COPYING.txt`. The project is published under the repository license in `LICENSE`.

## Notes for GitHub publishing

- The repository is structured for a standard GitHub push.
- The app builds successfully via `npm run build`.
- CI is configured in `.github/workflows/ci.yml` to validate the project on push and pull request.
- GitHub Pages deployment is configured in `.github/workflows/deploy-pages.yml`. Push to `main`, then set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The published URL will be `https://<your-github-username>.github.io/<repository-name>/`.
- GitHub Pages is static hosting: it cannot run the Ollama proxy or set the cross-origin isolation headers used by the full multithreaded Stockfish build. Chat and engine analysis therefore require local setup or hosting on a service that supports a backend and those headers. The Pages deployment is a static preview, not a full hosted replacement for local mode.
- A standard `.gitignore` is included to avoid committing dependencies and build output.

## License

This project is licensed under the GNU General Public License v3.0. See `LICENSE` for details.