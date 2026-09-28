# StockBot

A browser-based chess companion with Stockfish 19 analysis, legal play, FEN/PGN import, and optional local Ollama chat.

Stockbot is a browser-based chess analysis and coaching app powered by Stockfish 19 and a local Ollama chat model. It lets you play, analyze, import FEN/PGN positions, and inspect engine evaluations without sending data to a cloud service.

## Features

- Real chess logic using `chess.js`
- Stockfish 19 engine integration for live evaluation and best moves
- Analysis mode with principal variation arrow overlays
- FEN and PGN import with validation and support for PGN setup-position headers
- Board interaction with drag-and-drop piece movement
- Queen, rook, bishop, or knight promotion with cancel support
- Undo and redo, including full-turn takebacks in Play mode and one-ply navigation in Analysis mode
- Move-sequence opening detection with a general opening label when no variation matches
- Signed engine evaluations and mate scores; the advantage rail is not a win-probability estimate
- Local chat with Ollama using a lightweight model such as `qwen3:1.7b`
- Position-aware chess responses grounded in the current Stockfish line
- Modern UI for board, moves, engine output, and chat

## Getting started

The easiest way to run StockBot is with the setup script for your operating system. The script installs missing tools, downloads the local chat model, builds the app, and starts its development server. You need an internet connection and several gigabytes of free disk space. The Ollama model alone is about 1.4 GB.

### 1. Download the project

Choose either option:

- **Download ZIP:** On the [GitHub repository page](https://github.com/vuminhnhat880-code/StockBot), click **Code → Download ZIP**, then extract the ZIP file.
- **Use Git:** Open Terminal, PowerShell, or another command prompt and run:

```sh
git clone https://github.com/vuminhnhat880-code/StockBot.git
```

The commands below must be run from inside the extracted or cloned `StockBot` folder. If you cloned the repository, enter it with:

```sh
cd StockBot
```

If you downloaded a ZIP, open a terminal in the folder that contains `setup.sh` and `setup-windows.ps1`.

### 2. Run the setup script

#### macOS

Open **Terminal**, go to the `StockBot` folder, and run:

```sh
bash setup.sh
```

If needed, the script installs Homebrew, then uses it to install Node.js and Ollama. macOS may ask for your password to install system software. Type it into Terminal and press Enter; the password will not appear as you type.

#### Linux

Open a terminal in the `StockBot` folder and run:

```sh
bash setup.sh
```

The script supports apt, dnf, and pacman for installing Node.js/npm, and uses Ollama's official installer. It may ask for your administrator password through `sudo`. If your Linux distribution uses another package manager, install Node.js 18+ and npm yourself before running the script.

#### Windows 10/11

Open **PowerShell** in the `StockBot` folder. One way is to open the folder in File Explorer, click the address bar, type `powershell`, and press Enter. Then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

The script uses `winget` to install Node.js LTS and Ollama if they are missing. If Windows says `winget` is not recognized, install or update **App Installer** from the Microsoft Store, close and reopen PowerShell, then try again. Review and approve any Windows installation prompts.

### 3. Wait for setup to finish

The first run may take a while. The script will:

1. Check for Node.js and Ollama, installing them if needed.
2. Install the app's JavaScript packages with `npm ci`.
3. Start Ollama if it is not already running.
4. Download the `qwen3:1.7b` chat model (about 1.4 GB).
5. Build the app and start the development server.

When setup is complete, the terminal prints a local address, normally `http://localhost:5173`. Open that address in your web browser. Keep the terminal window open while using StockBot; press `Ctrl+C` in that window to stop the development server.

### Using StockBot

- Choose play mode to play against Stockfish, or analysis mode to explore a position.
- Drag a piece to make a move. Moves must be legal chess moves.
- Use the import controls to load a FEN position or PGN game.
- Review the engine evaluation, principal variation, and best-move arrow on the board.
- Use chat for general conversation. Chat runs locally through Ollama; it does not need a cloud account or API key.

### Start it again later

After the initial setup, you do not need to download the model or install packages again. Open a terminal in the `StockBot` folder and run:

```sh
npm run dev
```

If chat reports that Ollama is offline, start Ollama in another terminal with `ollama serve`, then refresh the StockBot page.

### Manual setup

If you prefer not to use the setup script, install Node.js 18+ (which includes npm) and Ollama for your operating system. Then open a terminal in the project folder and run these commands:

```sh
npm ci
ollama pull qwen3:1.7b
ollama serve
```

Leave `ollama serve` running. Open a second terminal in the project folder and start StockBot:

```sh
npm run dev
```

Open the local URL printed by Vite. To make a production build instead, run `npm run build`; generated files are placed in `dist/`.

### Troubleshooting

- **`node` or `npm` is not recognized:** Install Node.js 18 or newer, reopen the terminal, and check with `node --version` and `npm --version`.
- **`ollama` is not recognized after installation:** Close and reopen the terminal so it reloads the system PATH. On Windows, Ollama may also need to be launched once from the Start menu.
- **The model download is interrupted:** Make sure you have a stable internet connection and enough free disk space, then run `ollama pull qwen3:1.7b` again. Ollama can resume an incomplete download.
- **Chat says Ollama is offline:** Start the Ollama service with `ollama serve`. Keep it running while using the app, then refresh the page.
- **Port 5173 is already in use:** Vite will print a different local URL. Open the URL shown in the terminal.
- **The app does not start after installing tools:** Open a new terminal in the project folder and rerun the platform setup script.

## Project structure

```text
Stockbot/
├── public/
│   └── engine/
│       ├── stockfish-19.js
│       ├── stockfish-19.wasm
│       └── COPYING.txt
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── ChatPanel.tsx
│   │   ├── ChessBoard.tsx
│   │   ├── ImportModal.tsx
│   │   ├── PositionPanel.tsx
│   │   └── PromotionPicker.tsx
│   ├── hooks/
│   │   ├── useChessGame.ts
│   │   └── useStockfish.ts
│   ├── lib/
│   │   ├── chat.ts
│   │   ├── chess.ts
│   │   ├── openings.ts
│   │   └── stockfish.ts
│   ├── types/
│   │   └── chess.ts
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
