/* ==========================================================
   CONFIGURATION: change these values to tweak behavior
   ========================================================== */
const VALID_EMAIL = "qa.tester@example.com";
const VALID_PASSWORD = "Test@1234";
const MAX_FAILED_ATTEMPTS = 3;      // consecutive failures before lockout
const MIN_PASSWORD_LENGTH = 8;

/* Test-friendly overrides via URL query string (handy for Playwright / AI agents):
     index.html?delay=0      -> no simulated loading delay
     index.html?lock=5       -> lock for 5 seconds instead of 30
     index.html?reset=1      -> clear all stored state (attempts, lock, remembered email, session)
   Defaults apply when a parameter is missing or invalid. */
const params = new URLSearchParams(window.location.search);
function numParam(name, fallback) {
  const value = Number(params.get(name));
  return params.has(name) && Number.isFinite(value) && value >= 0 ? value : fallback;
}
const LOGIN_DELAY_MS = numParam("delay", 1000);       // simulated network delay
const LOCK_DURATION_SECONDS = numParam("lock", 30);   // lockout length

// Storage keys
const KEY_AUTH = "isLoggedIn";
const KEY_USER = "userEmail";
const KEY_REMEMBERED_EMAIL = "rememberedEmail";
const KEY_FAILED_ATTEMPTS = "failedAttempts";
const KEY_LOCK_UNTIL = "lockUntil";     // timestamp (ms) when the lock ends
const ALL_KEYS = [KEY_AUTH, KEY_USER, KEY_REMEMBERED_EMAIL, KEY_FAILED_ATTEMPTS, KEY_LOCK_UNTIL];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ==========================================================
   Storage helpers (try/catch in case storage is blocked)
   ========================================================== */
function safeGet(storage, key) { try { return storage.getItem(key); } catch (e) { return null; } }
function safeSet(storage, key, value) { try { storage.setItem(key, value); } catch (e) { /* ignore */ } }
function safeRemove(storage, key) { try { storage.removeItem(key); } catch (e) { /* ignore */ } }

/** Returns the logged-in email, or null. Checks both storages. */
function getLoggedInUser() {
  for (const storage of [sessionStorage, localStorage]) {
    if (safeGet(storage, KEY_AUTH) === "true") return safeGet(storage, KEY_USER);
  }
  return null;
}

/* ==========================================================
   Page router: one script serves both pages
   ========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "login") initLoginPage();
  if (page === "dashboard") initDashboardPage();
});

/* ==========================================================
   DASHBOARD PAGE
   ========================================================== */
function initDashboardPage() {
  const user = getLoggedInUser();

  // Not logged in -> back to login page
  if (!user) {
    window.location.replace("index.html");
    return;
  }

  document.getElementById("welcome-message").textContent = `Welcome, ${user}`;

  document.getElementById("logout-btn").addEventListener("click", () => {
    // Clear auth flags; the remembered email is kept on purpose (prefill)
    [sessionStorage, localStorage].forEach((s) => {
      safeRemove(s, KEY_AUTH);
      safeRemove(s, KEY_USER);
    });
    window.location.href = "index.html";
  });
}

/* ==========================================================
   LOGIN PAGE
   ========================================================== */
function initLoginPage() {
  // Optional full reset for clean test runs: index.html?reset=1
  if (params.get("reset") === "1") {
    [sessionStorage, localStorage].forEach((s) => ALL_KEYS.forEach((k) => safeRemove(s, k)));
  }

  // ----- Element references -----
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email-input");
  const passwordInput = document.getElementById("password-input");
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");
  const formError = document.getElementById("form-error");
  const forgotMessage = document.getElementById("forgot-password-message");
  const toggleBtn = document.getElementById("toggle-password-btn");
  const rememberCheckbox = document.getElementById("remember-me-checkbox");
  const forgotLink = document.getElementById("forgot-password-link");
  const loginBtn = document.getElementById("login-btn");

  let isSubmitting = false;
  let lockTimerId = null;

  /** Expose the current UI state to tests: idle | submitting | error | locked | success */
  function setState(state) { form.dataset.state = state; }

  // ----- Prefill remembered email -----
  const remembered = safeGet(localStorage, KEY_REMEMBERED_EMAIL);
  if (remembered) {
    emailInput.value = remembered;
    rememberCheckbox.checked = true;
  }

  /* ---------- Validation ---------- */
  function getEmailError() {
    const value = emailInput.value.trim();
    if (!value) return "Email is required";
    if (!EMAIL_REGEX.test(value)) return "Enter a valid email address";
    return "";
  }

  function getPasswordError() {
    const value = passwordInput.value;
    if (!value) return "Password is required";
    if (value.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    return "";
  }

  /** Show/clear a field error and sync aria-invalid. Returns true if valid. */
  function showFieldError(input, errorEl, message) {
    errorEl.textContent = message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
    return !message;
  }
  const validateEmail = () => showFieldError(emailInput, emailError, getEmailError());
  const validatePassword = () => showFieldError(passwordInput, passwordError, getPasswordError());

  /* ---------- Messages ---------- */
  /** type: "error" | "success" | "info" | "" (clears) */
  function setMessage(el, message, type) {
    el.textContent = message;
    el.classList.remove("is-error", "is-success", "is-info");
    if (message && type) el.classList.add(`is-${type}`);
  }
  const setFormMessage = (message, type) => setMessage(formError, message, type);

  /* ---------- Lockout logic ---------- */
  function getLockRemainingSeconds() {
    const until = Number(safeGet(localStorage, KEY_LOCK_UNTIL)) || 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }

  /** Starts (or resumes) the live countdown if the account is locked. */
  function startLockCountdown() {
    clearInterval(lockTimerId);

    const tick = () => {
      const remaining = getLockRemainingSeconds();
      if (remaining > 0) {
        loginBtn.disabled = true;
        setState("locked");
        setFormMessage(`Too many failed attempts. Try again in ${remaining} seconds.`, "error");
      } else {
        clearInterval(lockTimerId);
        safeRemove(localStorage, KEY_LOCK_UNTIL);
        safeSet(localStorage, KEY_FAILED_ATTEMPTS, "0");
        loginBtn.disabled = false;
        setState("idle");
        setFormMessage("", "");
      }
    };

    if (getLockRemainingSeconds() > 0) {
      tick();
      lockTimerId = setInterval(tick, 1000);
    }
  }

  function lockAccount() {
    safeSet(localStorage, KEY_LOCK_UNTIL, String(Date.now() + LOCK_DURATION_SECONDS * 1000));
    startLockCountdown();
  }

  /* ---------- Submitting state ---------- */
  function setSubmitting(state) {
    isSubmitting = state;
    loginBtn.disabled = state;
    loginBtn.textContent = state ? "Logging in..." : "Login";
    form.setAttribute("aria-busy", String(state));
    if (state) setState("submitting");
  }

  /* ---------- Mock authentication ---------- */
  function authenticate(email, password) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(email.toLowerCase() === VALID_EMAIL.toLowerCase() && password === VALID_PASSWORD);
      }, LOGIN_DELAY_MS);
    });
  }

  function handleSuccess(email) {
    safeSet(localStorage, KEY_FAILED_ATTEMPTS, "0");
    safeRemove(localStorage, KEY_LOCK_UNTIL);

    [sessionStorage, localStorage].forEach((s) => {
      safeRemove(s, KEY_AUTH);
      safeRemove(s, KEY_USER);
    });
    const storage = rememberCheckbox.checked ? localStorage : sessionStorage;
    safeSet(storage, KEY_AUTH, "true");
    safeSet(storage, KEY_USER, email);

    if (rememberCheckbox.checked) safeSet(localStorage, KEY_REMEMBERED_EMAIL, email);
    else safeRemove(localStorage, KEY_REMEMBERED_EMAIL);

    setState("success");
    setFormMessage("Login successful! Redirecting...", "success");
    window.location.href = "dashboard.html";
  }

  function handleFailure() {
    const attempts = (Number(safeGet(localStorage, KEY_FAILED_ATTEMPTS)) || 0) + 1;
    safeSet(localStorage, KEY_FAILED_ATTEMPTS, String(attempts));
    setSubmitting(false);

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockAccount();
    } else {
      setState("error");
      setFormMessage("Invalid email or password", "error");
    }
  }

  /* ---------- Event listeners ---------- */
  emailInput.addEventListener("blur", validateEmail);
  passwordInput.addEventListener("blur", validatePassword);

  // Once a field shows an error, re-validate as the user types
  emailInput.addEventListener("input", () => {
    if (emailInput.getAttribute("aria-invalid") === "true") validateEmail();
  });
  passwordInput.addEventListener("input", () => {
    if (passwordInput.getAttribute("aria-invalid") === "true") validatePassword();
  });

  // Show / Hide password
  toggleBtn.addEventListener("click", () => {
    const showing = passwordInput.type === "text";
    passwordInput.type = showing ? "password" : "text";
    toggleBtn.textContent = showing ? "Show" : "Hide";
    toggleBtn.setAttribute("aria-pressed", String(!showing));
    toggleBtn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });

  // Forgot password: inline message (no alert, so automation is never blocked by a dialog)
  forgotLink.addEventListener("click", (event) => {
    event.preventDefault();
    setMessage(forgotMessage, "Forgot password is not implemented in this practice app.", "info");
  });

  // Submit (also triggered by pressing Enter in any field)
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (getLockRemainingSeconds() > 0) {
      startLockCountdown();
      return;
    }

    setFormMessage("", "");
    setMessage(forgotMessage, "", "");

    emailInput.value = emailInput.value.trim();
    const emailOk = validateEmail();
    const passwordOk = validatePassword();

    if (!emailOk || !passwordOk) {
      setState("error");
      (emailOk ? passwordInput : emailInput).focus();
      return;
    }

    setSubmitting(true);
    const success = await authenticate(emailInput.value, passwordInput.value);
    if (success) handleSuccess(emailInput.value);
    else handleFailure();
  });

  // Resume the countdown if the page is reloaded during a lockout
  startLockCountdown();
}
