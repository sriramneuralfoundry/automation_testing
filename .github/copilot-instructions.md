# Login QA Practice App: Guide for AI testing agents

Use this file as context when testing the app with Playwright (MCP or test code).

## Run the app
- `npm install && npx playwright install` (first time only)
- `npm run serve` -> http://127.0.0.1:5500/index.html
- Automated tests: `npm test`

## Pages
- `/index.html`: login page
- `/dashboard.html`: protected page (redirects to `/index.html` when not logged in)

## Credentials
- Valid: `qa.tester@example.com` / `Test@1234`
- Any other valid-format credentials -> "Invalid email or password" (e.g. `qa.tester@example.com` / `Wrong@1234`)

## Locators (every element has an `id` AND a `data-testid` with the same value)
| Element | data-testid |
|---|---|
| Form | login-form (has `data-state`: idle / submitting / error / locked / success) |
| Email input / error | email-input / email-error |
| Password input / error | password-input / password-error |
| Show/Hide toggle | toggle-password-btn (label "Show password" / "Hide password") |
| Remember me | remember-me-checkbox |
| Forgot password link / message | forgot-password-link / forgot-password-message |
| Login button | login-btn |
| General error / success / lock message | form-error |
| Dashboard heading / welcome / logout | dashboard-title / welcome-message / logout-btn |

Prefer `page.getByTestId(...)`. Inputs also work with `getByLabel("Email")` / `getByLabel("Password")`.

## Rules and exact messages
- "Email is required" / "Enter a valid email address"
- "Password is required" / "Password must be at least 8 characters"
- Invalid fields get `aria-invalid="true"` and a red border. Validation runs on blur and on submit.
- Email is trimmed before validation.
- Submit shows "Logging in..." with a disabled button for ~1s.
- 3 consecutive failures -> lock (30s): "Too many failed attempts. Try again in X seconds." (live countdown, button disabled)
- Remember me checked -> login flag in localStorage and email prefilled next visit. Unchecked -> sessionStorage.
- Logout clears the session and returns to `/index.html`.

## URL parameters for faster testing (login page)
- `?delay=0`: skip the 1s login delay
- `?lock=5`: lock for 5 seconds instead of 30
- `?reset=1`: clear attempts, lock, remembered email and session
- Combine: `/index.html?delay=0&lock=5&reset=1`

## Notes for agents
- Failed-attempt count and lock persist in localStorage; use `?reset=1` or a fresh browser context between scenarios.
- There are no `alert()` dialogs; all messages are inline.
- Wait on `data-state` or message text instead of fixed sleeps.

## Example prompts
- "Open http://127.0.0.1:5500/index.html and test every validation rule. Report any mismatch from AGENTS.md."
- "Test the lockout flow using ?reset=1&lock=5 and verify the countdown and unlock."
- "Test the page at 320px and 1280px width and report layout issues."
