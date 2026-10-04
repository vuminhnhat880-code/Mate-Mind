<div align="center">

# ♞ StockBot

### A chessboard, a serious engine, and a friendly place to think out loud.

Play Stockfish. Explore a position. Import a game. Review the moves.<br>
**StockBot puts the board, engine analysis, game review, and optional local chat together in one workspace.**

[![CI](https://github.com/vuminhnhat880-code/StockBot/actions/workflows/ci.yml/badge.svg)](https://github.com/vuminhnhat880-code/StockBot/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/vuminhnhat880-code/StockBot/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/vuminhnhat880-code/StockBot/actions/workflows/deploy-pages.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[**Open the live preview**](https://vuminhnhat880-code.github.io/StockBot/) · [**Get it running locally**](#get-started) · [**Report a bug**](https://github.com/vuminhnhat880-code/StockBot/issues/new)

<br>

![StockBot showing a chessboard, engine analysis, move list, and chat](screenshots/stockbot.png)

*One board. Plenty of ways to learn from the position.*

</div>

## Welcome to the board

StockBot is a browser-based chess companion built around the real **Stockfish 19** engine and the chess rules library **chess.js**. Play as either color, follow the engine's analysis, explore your own variations, and review a game's moves—all without creating an account.

The chessboard and engine run in your browser. If you'd also like to chat about non-chess topics, you can optionally run [Ollama](https://ollama.com/) and its `qwen3:1.7b` model on your own computer.

> **Just want to try it?** The [GitHub Pages preview](https://vuminhnhat880-code.github.io/StockBot/) runs Stockfish in single-thread mode, so the engine works without special server headers. Ollama chat is available only when you run StockBot locally with Ollama.

<details>
<summary><strong>At a glance</strong></summary>

- **Play:** challenge Stockfish as White or Black; click, drag, or use the keyboard to move.
- **Analyze:** explore legal continuations, inspect engine candidates, and follow the evaluation graph.
- **Review:** re-analyze the current line and inspect heuristic move classifications.
- **Import:** load a six-field FEN or a PGN, including games that start from a custom position.
- **Chat:** ask chess questions using the board and real engine results; optionally talk about other things with a local model.
- **Privacy-minded:** no sign-in, cloud AI key, or remote chess-analysis service. See [Privacy & limitations](#deployment-and-privacy) for network details.

</details>

## Get started

### The quick setup

The setup script checks for prerequisites, installs project dependencies, starts Ollama if needed, downloads the `qwen3:1.7b` model, builds the app, and starts the local development server. The model download is about **1.4 GB**; allow several gigabytes of free disk space for the model and tools. Review installer prompts before approving them.

**Requirements:** Node.js **22.13 or newer** and npm. The optional general-chat feature also needs Ollama. The automated setup supports macOS, common Linux distributions, and Windows 10/11 with `winget`.

First, clone the project:

```sh
git clone https://github.com/vuminhnhat-code/StockBot.git
cd StockBot
```

Then run the setup script for your system:

| System | Command |
|---|---|
| macOS | `bash setup.sh` |
| Linux | `bash setup.sh` |
| Windows 10/11 | `powershell.exe -ExecutionPolicy Bypass -File .\setup-windows.ps1` |

On Windows, open **Windows PowerShell** (included with Windows) or run that same command from Command Prompt. The Windows setup script needs **Windows Package Manager (`winget`)**. If it isn't available, install Node.js 22.13+ and Ollama manually and follow the steps below.

When setup finishes, open the local address printed by Vite—usually **http://localhost:5173**. Keep that terminal open while you use StockBot; press **Ctrl+C** to stop the server.

### Set it up yourself

Install Node.js 22.13+ with npm and [Ollama](https://ollama.com/), then open a terminal in the project directory:

```sh
npm ci
ollama pull qwen3:1.7b
```

Start Ollama in one terminal:

```sh
ollama serve
```

Start StockBot in another:

```sh
npm run dev
```

Open the local URL Vite prints. You can use the board and engine without Ollama; Ollama is only needed for general-purpose local chat.

## ♜ Use StockBot

### Play a game

1. Choose **Play** and select whether you'd like White or Black.
2. Click a piece and a legal destination, drag a piece, or use the keyboard to navigate the board.
3. Stockfish makes its reply. If you choose Black, Stockfish plays the opening move for White.
4. Use **Undo** and **Redo** to revisit turns, or start a new game whenever you like.
5. Flip the board to change your viewing orientation.

Moves are checked by `chess.js`; the interface doesn't apply illegal moves. When a pawn reaches the far rank, choose a queen, rook, bishop, or knight.

### Analyze a position

Choose **Analysis** to examine a position or explore a line of your own. Make moves on the board, jump to a move in the timeline, and watch the engine's evaluation and best-move arrow update for the selected position. Undo and Redo move one ply at a time in Analysis mode.

The score is shown from **White's perspective**:

- A positive centipawn score favors White; a negative score favors Black.
- `M3` means a forced mate in three moves for White; `M-3` means a forced mate for Black.
- The evaluation bar and graph show engine advantage, **not** win probability.

An engine score is analysis, not a promise about the eventual game result. Search depth, time, hardware, and browser memory all affect how much Stockfish can examine.

### Tune the engine

Open **Engine settings** in the position panel. Settings are validated, bounded, and saved in your browser's local storage.

| Setting | Available values | What it changes |
|---|---:|---|
| Depth | 8–40 plies | Search depth for position analysis |
| Move time | 250–15,000 ms | Time budget for Stockfish's reply in Play mode |
| Threads | 1–16 | Worker threads when the host supports cross-origin isolation |
| Hash | 64–2,048 MB | Memory allocated to the engine's transposition table |
| MultiPV | 1, 2, 3, or 5 | Candidate lines shown during analysis |

More time, threads, and hash can use more CPU, memory, and battery. Hosts without cross-origin isolation automatically use the **full-strength single-threaded Stockfish 19 build**; the Threads setting is disabled there. Game Review searches are capped at depth 14 to keep long reviews manageable. Select **Stop analysis** to stop an analysis search.

### Review a game

Load or play a game, then select **Review**. StockBot analyzes the positions in the current line in sequence and shows progress. You can cancel at any time; cancelling clears partial review results and returns to live analysis.

The review includes:

- A final-position evaluation and a count of analyzed moves.
- A move-by-move classification, estimated centipawn loss, and evaluation change.
- A rough estimated-accuracy percentage and counts for each category.
- Links that take you back to the position after a reviewed move.

These labels are **heuristic estimates**, not official ratings or an objective judgment. They depend on the engine's evaluations and search depth. “Brilliant” is intentionally narrow: it looks for a material sacrifice with strong compensation. The accuracy percentage is a transformation of average centipawn loss, not a probability of playing accurately.

### Import FEN or PGN

1. Select **Import**.
2. Choose **FEN position** or **PGN game**.
3. Paste your notation and select **Load**.

FEN must contain all six fields—board, turn, castling rights, en-passant square, halfmove clock, and fullmove number. For example, the starting position is:

```text
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

PGN imports retain their headers and support custom starting positions with `[SetUp "1"]` and `[FEN "..."]`. Successful imports open in Analysis mode. Invalid notation shows an error and leaves the current game unchanged.

### Chat about chess—or something else

Chess questions are answered from the current board and the app's available Stockfish results. When the engine hasn't finished, StockBot says so rather than inventing a best move or evaluation.

For general questions, StockBot can send the conversation and current chess context to the **local Ollama service** on your computer. It uses `qwen3:1.7b`; no cloud account or API key is needed. General chat is optional and isn't available on GitHub Pages. If the board changes during an outstanding chat request, the old reply is discarded so it can't be mistaken for an answer about the new position.

## 🧰 For developers

### Requirements and commands

Use Node.js **22.13+** and npm. Install from the lockfile with `npm ci`.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local Vite development server |
| `npm run lint` | Lint application source |
| `npm test` | Run the Vitest test suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run coverage` | Run tests with V8 coverage |
| `npm run test:coverage` | Alias for `npm run coverage` |
| `npm run build` | Type-check and build the production site into `dist/` |
| `npm run preview` | Preview the production build locally |

Ollama isn't required for tests, lint, or builds.

### What's under the hood

- **React 19 + TypeScript** provide the application and UI.
- **chess.js** owns move legality, game state, FEN/PGN parsing, and check/draw rules.
- **Stockfish 19** runs in a browser worker and WebAssembly. StockBot translates UCI results into evaluations, candidate lines, and legal moves.
- **Ollama** is an optional local endpoint for general chat; Vite proxies `/api/ollama` to the local Ollama service during development.
- **Vitest + Testing Library** cover chess state, worker lifecycle and races, analysis/review, imports, chat behavior, and UI controls.

The app keeps chess rules, engine communication, chat, and UI components in separate modules:

```text
src/
├── App.tsx
├── components/   # Board, chat, import, position panel, promotion picker
├── hooks/        # Chess state, Stockfish, game review, chat
├── lib/          # Chess, engine, chat, and opening helpers
└── types/        # Shared game and engine types

public/engine/    # Stockfish 19 worker/WASM builds and license
.github/workflows # CI and GitHub Pages deployment
setup.sh          # macOS/Linux setup
setup-windows.ps1 # Windows setup
```

### CI

GitHub Actions uses Node.js 22 to install with `npm ci`, run lint and tests, and build the app. A separate workflow builds and deploys the GitHub Pages site when `main` is updated.

## Deployment and privacy

### GitHub Pages

The live preview is deployed from `main` using [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). To deploy your own fork, enable **GitHub Actions** as the Pages source in **Settings → Pages**.

GitHub Pages serves static files and cannot provide the cross-origin isolation headers required by Stockfish's multithreaded build or run a local Ollama proxy. StockBot detects that environment and uses the full-strength **single-threaded** Stockfish build instead, so the board and analysis remain functional. Expect a large engine download (about **95 MB** for the selected WebAssembly build) and slower searches than in a supported multithreaded local setup. Chat with Ollama requires the local development server and Ollama running on your own computer.

### Privacy & limitations

- Chess rules and Stockfish analysis run locally in your browser; no game account or cloud-analysis API is used.
- For general chat, the browser sends your message and chess context to the Ollama service on your own computer. The model is downloaded separately by Ollama.
- The page loads **DM Sans, DM Mono, and Manrope from Google Fonts**, which means it makes requests to Google Fonts.
- Game Review is sequential and depth-limited. Its classifications and estimated accuracy are informative heuristics, not official ratings.
- Stockfish needs a browser with WebAssembly and worker support. Memory, hardware, and host configuration affect startup and search speed.
- Chess pieces use Unicode glyphs, so their appearance can vary slightly between operating systems and fonts.

## ♟️ A few chess-and-code facts

- Stockfish reports scores from the side-to-move perspective; StockBot converts them to White's perspective for consistent display.
- Candidate lines come from Stockfish's actual MultiPV output—not from fabricated or random moves.
- Principal variations are replayed through `chess.js` and displayed in algebraic notation, such as `Nf3`, instead of raw UCI coordinates.
- Opening names come from StockBot's included opening sequences, with the longest matching sequence taking precedence.
- Review evaluations are tied to both the position's FEN and its ply, so a different branch won't reuse a review score just because it reaches a similar-looking board.

## 🤝 Contributing & getting help

Found a bug or have an idea? [Open an issue](https://github.com/vuminhnhat880-code/StockBot/issues/new) with the steps to reproduce it and what you expected to happen. Pull requests are welcome; before submitting, run:

```sh
npm run lint
npm test
npm run build
```

If StockBot is useful to you, a ⭐ on the [GitHub repository](https://github.com/vuminhnhat880-code/StockBot) helps other chess players discover it.

## License & engine attribution

StockBot is licensed under the **GNU General Public License v3.0**; see [`LICENSE`](LICENSE). It bundles [Stockfish 19](https://stockfishchess.org/), a strong open-source chess engine distributed under GPL-3.0. The engine's license and notices are included in [`public/engine/COPYING.txt`](public/engine/COPYING.txt).

<div align="center">

**Thanks for stopping by.** Make yourself at home, find a good move, and enjoy the game. ♞

</div>
