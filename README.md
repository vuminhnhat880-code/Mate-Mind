<div align="center">

# ♞ StockBot

### Play the position. Read the evaluation. Ask better questions.

**A local-first chess companion** for playing against Stockfish 19, exploring variations, reviewing games, and chatting with your board in view.

[![CI](https://github.com/vuminhnhat880-code/StockBot/actions/workflows/ci.yml/badge.svg)](https://github.com/vuminhnhat880-code/StockBot/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/vuminhnhat880-code/StockBot/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/vuminhnhat880-code/StockBot/actions/workflows/deploy-pages.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

> **In a nutshell:** chess rules and legal moves come from [`chess.js`](https://github.com/jhlywa/chess.js), analysis runs in a Stockfish 19 Web Worker, and optional general-purpose chat runs locally through Ollama. There is no cloud AI account or API key.

<div align="center">

![StockBot showing the chessboard, Stockfish analysis, move list, and chat](screenshots/stockbot.png)

*Play, analyze, import a game, or ask about the position—all in one workspace.*

</div>

## Find your way around

| I want to… | Go to |
|---|---|
| Install StockBot | [Getting started](#getting-started) |
| Learn the controls | [Using StockBot](#using-stockbot) |
| Configure the engine | [Engine settings](#engine-settings) |
| Run checks or build | [Development and tests](#development-and-tests) |
| Fix a setup problem | [Troubleshooting](#troubleshooting) |
| Understand hosting and privacy | [Deployment, privacy, and limitations](#deployment-privacy-and-limitations) |

## What StockBot can do

### Play and explore

- **Play a complete game** against Stockfish 19 as White or Black. Stockfish makes the first move if you choose Black.
- **Switch to Analysis** to explore legal continuations without an opponent playing back.
- **Move with a mouse, touch, or keyboard.** Select a piece and a destination, drag a piece, or focus a board square and navigate with arrow keys. Legal moves are validated by `chess.js`.
- **Undo, redo, branch, and revisit** the move timeline. Play mode takes back a full turn when possible; Analysis mode navigates one ply at a time. Making a move after going back creates a new line.
- **Promote to queen, rook, bishop, or knight.** The move is applied only after a promotion choice.

### Understand the position

- **Stockfish analysis** provides a White-perspective evaluation, best move, principal variation, and an arrow on the board.
- **MultiPV** compares 1, 2, 3, or 5 engine candidate lines, with each line's rank, evaluation, first move, variation, and depth.
- **Evaluation history** plots completed scores on a lightweight graph. Select a point to revisit its position. It shows engine advantage, **not win probability**.
- **Game Review** re-analyzes a move line sequentially. It reports progress, can be cancelled, records evaluations on the same history graph, and links notable moves back to the board.
- **Opening recognition** matches the longest known SAN move prefix in a local ECO/opening list.
- **FEN and PGN import** supports six-field FEN positions and PGNs with move history, headers, and custom starting positions.

### Talk through a game

- Chess-specific questions use deterministic app logic and the current Stockfish result. If Stockfish has not completed an evaluation, StockBot says so instead of inventing one.
- Other questions can be sent to the local Ollama model **`qwen3:1.7b`**. Ollama is optional; general chat needs it, but chess play and analysis do not.
- Chat requests include the current board context. Requests are cancelled when the position changes, and failures or timeouts produce a clear fallback.

### Move with confidence

Board squares have accessible labels and arrow-key navigation. Dialogs support Escape, focus trapping, and focus restoration; reduced-motion preferences are respected. Unicode chess pieces keep the existing visual style, though their exact shapes can vary slightly between system fonts.

## Getting started

### Recommended: automatic setup

The setup scripts install missing prerequisites where supported, install dependencies, start Ollama, download the local model, build the app, and start the development server. The model download is about **1.4 GB**; allow several gigabytes of free disk space for tools, dependencies, and model files.

First, get the repository:

```sh
git clone https://github.com/vuminhnhat880-code/StockBot.git
cd StockBot
```

Or use **Code → Download ZIP** on the [GitHub repository](https://github.com/vuminhnhat880-code/StockBot), extract it, and open a terminal in the extracted folder.

Then run the script for your operating system:

| Operating system | Command |
|---|---|
| macOS | `bash setup.sh` |
| Linux | `bash setup.sh` |
| Windows 10/11 (PowerShell) | `powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1` |

On macOS, the script may install Homebrew if needed. On Linux, it supports `apt`, `dnf`, and `pacman`; another distribution may require installing Node.js 18+ and npm manually. On Windows, the script requires `winget` (App Installer). Review installer prompts and permissions before approving them.

When setup finishes, open the local address printed in the terminal—normally **http://localhost:5173**. Keep the terminal open while using the app; press **Ctrl+C** there to stop the development server.

<details>
<summary><strong>Prefer to install everything yourself?</strong></summary>

Install Node.js 18+ (with npm) and Ollama, then from the project directory run:

```sh
npm ci
ollama pull qwen3:1.7b
ollama serve
```

Keep Ollama running. In another terminal, start StockBot:

```sh
npm run dev
```

Open the local URL Vite prints. To stop the development server, press **Ctrl+C** in its terminal.

</details>

### Using StockBot

#### Play a game

1. Select **Play** above the board.
2. Choose the color you want to play. If you choose Black, Stockfish makes the opening move.
3. Select a piece and destination square, or drag the piece to its destination. Illegal moves are not applied.
4. Use the left arrow to take back a turn and the right arrow to restore it. Use the flip-board control to change your viewing orientation.
5. Start a fresh game with the reset control. A new game clears the previous move history.

#### Analyze a position

Select **Analysis** to explore legal continuations. Click or drag pieces to make moves; select moves in the move list to jump to that point. The evaluation, engine line, and best-move arrow update for the selected board position. Undo and Redo move one ply at a time in this mode.

The score is from White's perspective: a positive centipawn score favors White, a negative score favors Black, and `M3`/`M-3` reports a forced mate for White/Black. Stockfish strength depends on the hardware and search time, so an evaluation is analysis—not a guarantee of the game result.

### Engine settings

Open **Engine settings** in the position panel. Values are bounded, validated, and saved in this browser's local storage.

| Setting | Available range | What it controls |
|---|---:|---|
| Depth | 8–40 plies | Search depth for analysis positions |
| Move time | 250–15,000 ms | Time budget for Stockfish's Play-mode reply |
| Threads | 1–16 | Engine worker threads; higher values increase CPU use |
| Hash | 64–2,048 MB | Memory available to Stockfish's transposition table |
| MultiPV | 1, 2, 3, or 5 | Number of candidate lines shown in Analysis mode |

Higher settings can use more CPU, memory, and battery. Analysis and review use the configured depth; Game Review caps each search at depth 14 to limit the cost on long games. Play replies use the configured move-time budget. **Stop analysis** stops the current search; changing the position or settings starts a fresh one.

The candidate list is Stockfish MultiPV output, not separately generated moves. The evaluation graph only plots completed scores; select a point to navigate to its recorded ply. The graph shows White advantage and is not a win-probability chart.

### Review a game

Select **Review** to re-analyze the current move line one position at a time. The panel shows progress and can be cancelled; reviewed evaluations are added to the existing graph. A summary includes analyzed positions, move-category counts, an estimated accuracy, and notable moments that link to their board positions.

Move labels compare consecutive Stockfish evaluations from the perspective of the player who moved. The accuracy percentage is a rough transformation of average centipawn loss—not a statistical probability or tournament rating. “Brilliant” is deliberately rare and heuristic: it looks for a material sacrifice with a strong compensated position. These labels are not official ratings, a complete chess.com-style review, or an objective judgment. Results also depend on the selected engine depth, hardware, and how an engine scores forced mates.

#### Import a game or position

1. Select **Import** above the board.
2. Choose **FEN position** to load one position or **PGN game** to load a move record.
3. Paste the notation and choose **Load**. Invalid input displays an error and leaves the current game unchanged.
4. Imported PGNs retain their headers and honor `[SetUp "1"]` plus `[FEN "..."]` when present. Imports open in Analysis mode.

FEN must include all six fields. For example, the standard starting position is:

```text
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

### Use chat

Chess questions such as “What is the best move?” are answered using the current board and completed Stockfish result. Other questions go to the configured local Ollama model. If Ollama is unavailable or a request times out, the conversation remains visible and StockBot provides a fallback; general questions are not answered with invented chess facts.

The chat model runs locally and does not require a cloud account or API key. For general Ollama requests, StockBot sends the current FEN, move history, opening, completed evaluation and engine line (when available), material balance, and game mode. Requests use a timeout and are discarded if the board changes while Ollama is responding.

### Start it again later

Once installed, open a terminal in the project directory and run:

```sh
npm run dev
```

Leave Ollama running in the background if you want general chat. If it has stopped, run `ollama serve` in another terminal. Vite prints the local address; `Ctrl+C` stops the development server.

## Development and tests

Requirements: Node.js 18+ and npm. Install dependencies with `npm ci`. Ollama is only needed to develop or use live model chat; the tests do not call Ollama or download a model.

```sh
npm run dev
npm run build
npm test
npm run coverage
```

`npm run test:watch` starts Vitest in watch mode. `npm run test:coverage` is an alias for `npm run coverage`. The production build runs the TypeScript project checks before creating static files in `dist/`. Tests cover the `chess.js`-backed game hook, Stockfish worker lifecycle/queue and UCI parsing, evaluation conversion, game review, chat requests, settings, and opening matching. They test the existing chess rules integration rather than reimplementing chess rules.

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
- `src/hooks/useGameReview.ts` coordinates sequential review searches, progress, cancellation, and move estimates.
- `src/hooks/useChat.ts` owns Ollama availability, chat requests, timeouts, cancellation, and stale-position protection; `src/lib/chat.ts` retains intent and response domain logic.
- `src/components/ChessBoard.tsx` renders the board, evaluation rail, best-move arrow, and game result.
- `src/components/PositionPanel.tsx` renders move navigation, position details, and engine insight.
- `src/components/ChatPanel.tsx`, `ImportModal.tsx`, and `PromotionPicker.tsx` own their respective UI surfaces.
- `src/lib/openings.ts` contains the sequence-based opening data; `chat.ts`, `chess.ts`, and `stockfish.ts` contain reusable domain helpers.
- `src/types/chess.ts` contains shared game, engine, promotion, and chat types.
- `src/**/*.test.ts` contains Vitest regression tests, including mocked-worker lifecycle and stale-response checks.

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

## Deployment, privacy, and limitations

### GitHub Pages

Deployment is configured in `.github/workflows/deploy-pages.yml`. In **Settings → Pages**, select **GitHub Actions** as the deployment source. Once enabled, pushes to `main` build and deploy the static site at `https://<your-github-username>.github.io/<repository-name>/`.

GitHub Pages serves static files only. It cannot run the Ollama proxy or configure the cross-origin isolation headers required by the full multithreaded Stockfish build. Pages is therefore a static preview, not a replacement for local mode. For full engine and chat functionality, run locally or use a host that supports the required headers and a backend/proxy for Ollama. Local Vite dev/preview configure the required isolation headers.

### Privacy and limitations

- Stockfish analysis runs in the browser using the bundled worker and WebAssembly engine. Ollama chat is optional and runs through the local Ollama service; no cloud API key is needed.
- General chat context includes the current FEN, move history, opening, completed evaluation and engine line when available, material balance, and game mode. Chat questions that depend on engine analysis use the real current Stockfish result or report that one is not ready.
- Game Review is a sequential, depth-limited heuristic review. Category labels and its estimated accuracy are informative approximations, not objective or proprietary ratings.
- Browser support, available memory, and hardware affect Stockfish startup and strength. If a browser or host blocks WebAssembly workers, lacks the required isolation, or cannot allocate enough memory, the UI reports an engine error instead of presenting fabricated analysis.
- Chess pieces use styled Unicode glyphs to preserve the existing visual design; their exact shape can vary by system font.

## License

This project is licensed under the GNU General Public License v3.0. See `LICENSE` for details.
