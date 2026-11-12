# Login QA Practice
# Claude + Playwright V/S VS Code + Playwright

A small login application built for QA and test-automation practice, using only HTML, CSS and vanilla JavaScript (no frameworks, no libraries, no backend, no build tools). It is designed to be tested by scripted Playwright tests and by AI agents (GitHub Copilot and Claude) through the Playwright MCP server.

## Features

- Login page and a protected dashboard page
- Email and password validation on submit and on blur, with specific error messages
- Show/Hide password toggle, "Remember me" checkbox and a "Forgot password?" placeholder
- Mock authentication with a simulated 1-second loading delay
- Account lockout for 30 seconds after 3 consecutive failed attempts, with a live countdown
- Session handling (sessionStorage, or localStorage when "Remember me" is checked)
- Dashboard shows a welcome message and a Logout button; opening it while logged out redirects to the login page

## Demo credentials

| Field | Value |
|---|---|
| Email | `qa.tester@example.com` |
| Password | `Test@1234` |

Any other valid-format credentials show "Invalid email or password".

## Validation messages

| Situation | Message |
|---|---|
| Empty email | Email is required |
| Bad email format | Enter a valid email address |
| Empty password | Password is required |
| Password under 8 characters | Password must be at least 8 characters |
| Wrong credentials | Invalid email or password |
| Locked out | Too many failed attempts. Try again in X seconds. |

## Project structure

```
.
├── index.html                      Login page
├── dashboard.html                  Page shown after a successful login
├── style.css                       Styles (responsive, mobile-first)
├── script.js                       Validation, mock auth, lockout, session logic
├── package.json                    npm scripts and Playwright dependency
├── playwright.config.js            Playwright settings (desktop and mobile projects)
├── tests/
│   └── login.spec.js               Automated test suite (32 test runs)
├── .vscode/
│   └── mcp.json                    Playwright MCP server for VS Code Copilot
├── .github/
│   └── copilot-instructions.md     Guide that Copilot reads automatically
├── AGENTS.md                       Guide for AI testing agents
├── CLAUDE.md                       Guide that Claude Code reads automatically
└── README.md                       This file
```

## Requirements

- Node.js (LTS version) and npm
- A modern browser (Microsoft Edge or Chrome)
- VS Code (only needed for the Copilot setup)

## Getting started

1. Clone or download this repository and open the folder in a terminal.
2. Install dependencies and the Playwright browsers:
   ```bash
   npm install
   npx playwright install
   ```
3. Start the app:
   ```bash
   npm run serve
   ```
4. Open http://127.0.0.1:5500/index.html

You can also open `index.html` directly in a browser, but running the local server is recommended for testing.

> **Windows PowerShell note:** if npm is blocked with a "running scripts is disabled" error, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then reopen the terminal. Command Prompt does not have this restriction.

## Running the automated tests

```bash
npm test             # run the Playwright suite (starts the server automatically)
npm run test:ui      # run in Playwright's interactive UI mode
npm run report       # open the last HTML report
```

The suite runs on a desktop Chromium profile and a mobile device profile, for 32 test runs in total. Latest result: **32 passed, 0 failed**.

Covered scenarios:

- Validation: required fields, invalid email, short password, validation on blur, email whitespace trimming
- Password Show/Hide toggle
- Authentication: wrong credentials, loading state with disabled button, Enter-key submit, lockout and unlock, lockout surviving a page reload
- Dashboard and session: successful login, logout, redirect when logged out, "Remember me" prefill
- Forgot password placeholder message

## Test-friendly features

The app is built to be easy to automate:

- Every interactive element and message has a unique `id` and a matching `data-testid`
- The login form exposes its state in `data-state`: `idle`, `submitting`, `error`, `locked` or `success`
- Error messages use `aria-live="polite"` and invalid fields use `aria-invalid="true"`
- Messages are shown inline instead of browser `alert()` dialogs, which can block automation

Main test IDs:

| Element | data-testid |
|---|---|
| Email input / error | `email-input` / `email-error` |
| Password input / error | `password-input` / `password-error` |
| Show/Hide button | `toggle-password-btn` |
| Remember me | `remember-me-checkbox` |
| Forgot password link / message | `forgot-password-link` / `forgot-password-message` |
| Login button | `login-btn` |
| General message | `form-error` |
| Dashboard welcome / Logout | `welcome-message` / `logout-btn` |

### URL options for faster testing

Add these to the login page URL, for example `index.html?delay=0&lock=5&reset=1`:

| Option | Effect |
|---|---|
| `?delay=0` | Skips the 1-second login delay |
| `?lock=5` | Locks for 5 seconds instead of 30 |
| `?reset=1` | Clears failed attempts, lock, remembered email and session |

## AI-assisted testing with Playwright MCP

Two AI tools can drive a real browser through the Playwright MCP server. Both read a guide file that lists the credentials, element IDs, rules and exact messages.

### GitHub Copilot in VS Code (verified working)

1. Open this folder in VS Code and sign in to GitHub Copilot.
2. Start the app with `npm run serve`.
3. Press `Ctrl + Shift + P`, run **MCP: List Servers**, and start the `playwright` server (configured in `.vscode/mcp.json` to use Microsoft Edge).
4. Open Copilot Chat in agent mode and ask it to test the login page, for example:
   > Use only the browser tools from the MCP server named "playwright". Open http://127.0.0.1:5500/index.html?reset=1&lock=5&delay=0 and test every validation rule, a wrong password, the lockout after 3 failures, and a valid login. Tell me what passed and failed.

Copilot completed all login scenarios with no failures.

### Claude Code (installed, pending paid plan)

```bash
claude mcp add playwright -- npx @playwright/mcp@latest
claude
```

Claude Code is installed and connected to the Playwright MCP server. Signing in requires a paid Claude plan or API credits, so it has not been run yet. It reads `CLAUDE.md` automatically.

## Troubleshooting

| Problem | Fix |
|---|---|
| `package.json` not found | You are in the wrong folder. Open the folder that contains `package.json` |
| Page does not load, connection refused | The server is not running. Start it with `npm run serve` |
| Login button stays disabled | The lockout is active. Wait for the countdown or open the page with `?reset=1` |
| MCP browser says Chrome is missing | Use Microsoft Edge in `.vscode/mcp.json` (`--browser msedge`) |
| Copilot cannot see Playwright tools | Open the folder that contains `.vscode/mcp.json`, start the server from MCP: List Servers, and use agent mode |
| Port 5500 already in use | Close old terminals running the server, then start it again |

## Notes

- This is a practice application. The credentials are hardcoded in `script.js` and must never be used for real authentication.
- Failed-attempt count and lock time are stored in the browser's localStorage. Clear it in DevTools (Application, Local Storage) to reset manually, or use `?reset=1`.
- Settings such as the credentials, maximum attempts and lock time are constants at the top of `script.js`.
