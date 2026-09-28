# StockBot

A browser-based chess companion with Stockfish 19 analysis, legal play, FEN/PGN import, and optional local Ollama chat.

Stockbot is a browser-based chess analysis and coaching app powered by Stockfish 19 and a local Ollama chat model. It lets you play, analyze, import FEN/PGN positions, and inspect engine evaluations without sending data to a cloud service.

## Features

- **Play:** play legal chess moves against Stockfish 19. Choose White or Black with the side selector.
- **Analyze:** explore legal variations on the board. Stockfish continuously evaluates the current position and displays a best-move arrow and principal variation.
- **Import games and positions:** load a six-field FEN or a PGN, including games that start from a custom FEN. Imported games open in Analysis mode.
- **Navigate move history:** use Undo and Redo, or select a move in the move list. Play-mode Undo takes back a full turn when possible; Analysis Undo moves back one ply. Starting a new move from an earlier position creates a new line and clears the old future.
- **Promote pawns:** choose a queen, rook, bishop, or knight. The move is not applied until you choose, and Cancel leaves the board unchanged.
- **Identify openings:** the app matches the played SAN move sequence against a local opening list. It shows a broad opening family when no known variation matches.
- **Chat locally:** Ollama and `qwen3:1.7b` handle general questions. Chess-specific replies use the current board and completed Stockfish result; they do not invent an evaluation if the engine has not produced one.
- **Use signed evaluations:** scores such as `+1.25`, `-0.60`, and `M-3` are shown from White's perspective. The evaluation rail visualizes advantage; it is not a win-probability estimate.
- **Keep play local:** in local development, the board and engine run in the browser, and chat requests go to the Ollama service on your own machine.

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

#### Play a game

1. Select **Play** above the board.
2. Choose the color you want to play. If you choose Black, Stockfish makes the opening move.
3. Select a piece and destination square, or drag the piece to its destination. Illegal moves are not applied.
4. Use the left arrow to take back a turn and the right arrow to restore it. Use the flip-board control to change your viewing orientation.
5. Start a fresh game with the reset control. A new game clears the previous move history.

#### Analyze a position

Select **Analysis** to explore legal continuations. Click or drag pieces to make moves; select moves in the move list to jump to that point. The evaluation, engine line, and best-move arrow update for the selected board position. Undo and Redo move one ply at a time in this mode.

The score is from White's perspective: a positive centipawn score favors White, a negative score favors Black, and `M3`/`M-3` reports mate in three for the indicated side. Stockfish strength depends on the hardware and search time, so an evaluation is engine analysis, not a guarantee of the game result.

#### Import a game or position

1. Select **Import** above the board.
2. Choose **FEN position** to load one position or **PGN game** to load a move record.
3. Paste the notation and choose **Load**. Invalid input displays an error and leaves the current game unchanged.
4. Imported PGNs retain their headers and honor `[SetUp "1"]` plus `[FEN "..."]` when present. Imports open in Analysis mode.

FEN must include all six fields. For example, the standard starting position is:

```text
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

#### Use chat

Chess questions such as “What is the best move?” are answered from Stockfish's current evaluation and principal variation. Other questions go to the configured local Ollama model. If Ollama is unavailable or a request times out, the conversation remains visible and StockBot provides a fallback; general questions are not answered with invented chess facts.

The chat model runs locally and does not require a cloud account or API key. The app sends the model the current FEN, move history, opening, evaluation, best move, principal variation, search depth, material balance, and game mode so its chess explanations can use the same position the board displays.

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

The code is split by responsibility so the board UI is separate from game rules, engine communication, and chat response logic:

- `src/hooks/useChessGame.ts` owns the chess instance, move timeline/cursor, selection, import, promotion, and undo/redo.
- `src/hooks/useStockfish.ts` owns the single Stockfish worker, UCI setup, search queue, evaluations, and principal variation.
- `src/components/ChessBoard.tsx` renders the board, evaluation rail, best-move arrow, and game result.
- `src/components/PositionPanel.tsx` renders move navigation, position details, and engine insight.
- `src/components/ChatPanel.tsx`, `ImportModal.tsx`, and `PromotionPicker.tsx` own their respective UI surfaces.
- `src/lib/openings.ts` contains the sequence-based opening data; `chat.ts`, `chess.ts`, and `stockfish.ts` contain reusable domain helpers.
- `src/types/chess.ts` contains shared game, engine, promotion, and chat types.

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

The engine uses the bundled JavaScript worker and WebAssembly binary. Local Vite development and preview configure the cross-origin isolation headers required by the multithreaded build. Engine evaluations are parsed from actual UCI output; Stockbot applies engine moves only when they are legal in the current position.

## Notes for GitHub publishing

- The repository is structured for a standard GitHub push.
- The app builds successfully via `npm run build`.
- CI is configured in `.github/workflows/ci.yml` to validate the project on push and pull request.
- GitHub Pages deployment is configured in `.github/workflows/deploy-pages.yml`. In **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. After Pages is enabled, pushes to `main` build and deploy the static site to `https://<your-github-username>.github.io/<repository-name>/`.
- GitHub Pages serves static files only. It cannot run the Ollama proxy or configure the cross-origin isolation headers needed by the full multithreaded Stockfish build. For complete engine and chat functionality, run locally or host the app on a service that supports a backend and those headers. Pages is a static preview, not a replacement for local mode.
- A standard `.gitignore` is included to avoid committing dependencies and build output.

## License

This project is licensed under the GNU General Public License v3.0. See `LICENSE` for details.
