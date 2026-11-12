// @ts-check
const { test, expect } = require("@playwright/test");

const VALID_EMAIL = "qa.tester@example.com";
const VALID_PASSWORD = "Test@1234";
const WRONG_PASSWORD = "Wrong@1234"; // valid format, wrong value

// ?delay=0 removes the 1s wait, ?lock=3 shortens the lockout. Each test gets a fresh browser context.
const LOGIN_URL = "/index.html?delay=0&lock=3";

test.beforeEach(async ({ page }) => {
  await page.goto(LOGIN_URL);
});

async function login(page, email, password) {
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-btn").click();
}

test.describe("Validation", () => {
  test("shows required errors on empty submit", async ({ page }) => {
    await page.getByTestId("login-btn").click();
    await expect(page.getByTestId("email-error")).toHaveText("Email is required");
    await expect(page.getByTestId("password-error")).toHaveText("Password is required");
    await expect(page.getByTestId("email-input")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("password-input")).toHaveAttribute("aria-invalid", "true");
  });

  test("rejects an invalid email format", async ({ page }) => {
    await login(page, "not-an-email", VALID_PASSWORD);
    await expect(page.getByTestId("email-error")).toHaveText("Enter a valid email address");
  });

  test("rejects a short password", async ({ page }) => {
    await login(page, VALID_EMAIL, "short");
    await expect(page.getByTestId("password-error")).toHaveText("Password must be at least 8 characters");
  });

  test("validates on blur", async ({ page }) => {
    await page.getByTestId("email-input").focus();
    await page.getByTestId("password-input").focus(); // blur email
    await expect(page.getByTestId("email-error")).toHaveText("Email is required");
  });

  test("trims whitespace around the email", async ({ page }) => {
    await login(page, `   ${VALID_EMAIL}   `, VALID_PASSWORD);
    await expect(page).toHaveURL(/dashboard\.html/);
  });
});

test.describe("Password toggle", () => {
  test("switches between password and text", async ({ page }) => {
    const input = page.getByTestId("password-input");
    const toggle = page.getByTestId("toggle-password-btn");
    await expect(input).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");
    await expect(toggle).toHaveText("Hide");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "password");
  });
});

test.describe("Authentication", () => {
  test("wrong credentials show a general error", async ({ page }) => {
    await login(page, VALID_EMAIL, WRONG_PASSWORD);
    await expect(page.getByTestId("form-error")).toHaveText("Invalid email or password");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-state", "error");
  });

  test("button is disabled and shows 'Logging in...' while submitting", async ({ page }) => {
    await page.goto("/index.html?delay=1000&lock=3");
    await page.getByTestId("email-input").fill(VALID_EMAIL);
    await page.getByTestId("password-input").fill(WRONG_PASSWORD);
    await page.getByTestId("login-btn").click();
    await expect(page.getByTestId("login-btn")).toBeDisabled();
    await expect(page.getByTestId("login-btn")).toHaveText("Logging in...");
    await expect(page.getByTestId("form-error")).toHaveText("Invalid email or password");
    await expect(page.getByTestId("login-btn")).toBeEnabled();
  });

  test("pressing Enter submits the form", async ({ page }) => {
    await page.getByTestId("email-input").fill(VALID_EMAIL);
    await page.getByTestId("password-input").fill(VALID_PASSWORD);
    await page.getByTestId("password-input").press("Enter");
    await expect(page).toHaveURL(/dashboard\.html/);
  });

  test("locks after 3 failed attempts, then unlocks", async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await login(page, VALID_EMAIL, WRONG_PASSWORD);
      if (i < 2) await expect(page.getByTestId("form-error")).toHaveText("Invalid email or password");
    }
    await expect(page.getByTestId("form-error")).toContainText("Too many failed attempts. Try again in");
    await expect(page.getByTestId("login-btn")).toBeDisabled();
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-state", "locked");

    // Lock is 3s in this test, so it should release shortly
    await expect(page.getByTestId("login-btn")).toBeEnabled({ timeout: 8000 });
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-state", "idle");
  });

  test("lockout survives a page reload", async ({ page }) => {
    for (let i = 0; i < 3; i++) await login(page, VALID_EMAIL, WRONG_PASSWORD);
    await expect(page.getByTestId("login-btn")).toBeDisabled();
    await page.reload();
    await expect(page.getByTestId("login-btn")).toBeDisabled();
    await expect(page.getByTestId("form-error")).toContainText("Too many failed attempts");
  });
});

test.describe("Dashboard and session", () => {
  test("successful login shows welcome message and logout works", async ({ page }) => {
    await login(page, VALID_EMAIL, VALID_PASSWORD);
    await expect(page).toHaveURL(/dashboard\.html/);
    await expect(page.getByTestId("welcome-message")).toHaveText(`Welcome, ${VALID_EMAIL}`);
    await page.getByTestId("logout-btn").click();
    await expect(page).toHaveURL(/index\.html/);

    // Session is cleared: dashboard must redirect back
    await page.goto("/dashboard.html");
    await expect(page).toHaveURL(/index\.html/);
  });

  test("dashboard redirects to login when not logged in", async ({ page }) => {
    await page.goto("/dashboard.html");
    await expect(page).toHaveURL(/index\.html/);
  });

  test("Remember me prefills the email on the next visit", async ({ page }) => {
    await page.getByTestId("remember-me-checkbox").check();
    await login(page, VALID_EMAIL, VALID_PASSWORD);
    await expect(page).toHaveURL(/dashboard\.html/);
    await page.getByTestId("logout-btn").click();
    await expect(page.getByTestId("email-input")).toHaveValue(VALID_EMAIL);
    await expect(page.getByTestId("remember-me-checkbox")).toBeChecked();
  });

  test("without Remember me the email is not prefilled", async ({ page }) => {
    await login(page, VALID_EMAIL, VALID_PASSWORD);
    await page.getByTestId("logout-btn").click();
    await expect(page.getByTestId("email-input")).toHaveValue("");
  });
});

test.describe("Forgot password", () => {
  test("shows an inline placeholder message", async ({ page }) => {
    await page.getByTestId("forgot-password-link").click();
    await expect(page.getByTestId("forgot-password-message")).toContainText("not implemented");
  });
});
