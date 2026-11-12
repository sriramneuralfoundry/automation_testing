// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5500",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Starts a static server automatically; reuses it if you already ran `npm run serve`
  webServer: {
    command: "npx --yes http-server . -p 5500 -a 127.0.0.1 -c-1",
    url: "http://127.0.0.1:5500/index.html",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
