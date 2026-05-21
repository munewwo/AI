#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout, exit } = require("node:process");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Could not load Playwright. Run via ./scripts/run-login-pokerweb.sh or set NODE_PATH to a node_modules containing playwright.");
  throw error;
}

function loadDotEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

const config = {
  url: process.env.POKERWEB_URL || "https://japanopt.pokerweb.com.br/usuarios/login/?",
  username: process.env.POKERWEB_USERNAME,
  password: process.env.POKERWEB_PASSWORD,
  twoFactorCode: process.env.POKERWEB_2FA_CODE,
  profileDir: process.env.POKERWEB_PROFILE_DIR || ".pokerweb-profile",
  headless: /^true$/i.test(process.env.POKERWEB_HEADLESS || "false"),
  browserChannel: process.env.POKERWEB_BROWSER_CHANNEL || "chrome",
  maxTwoFactorAttempts: Number(process.env.POKERWEB_2FA_ATTEMPTS || 3),
};

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    exit(2);
  }
}

function ensureArtifactsDir() {
  const dir = path.join(process.cwd(), "artifacts");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function promptForCode(attempt) {
  if (config.twoFactorCode) return config.twoFactorCode;

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const suffix = attempt > 1 ? ` (attempt ${attempt})` : "";
    return (await rl.question(`2FA code${suffix}: `)).trim();
  } finally {
    rl.close();
  }
}

async function promptForUsername() {
  if (config.username) return config.username;

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question("Username: ")).trim();
  } finally {
    rl.close();
  }
}

async function looksLoggedIn(page) {
  const url = new URL(page.url());
  return !url.pathname.includes("/usuarios/login");
}

async function clickEntrar(page) {
  await page.getByRole("button", { name: /^Entrar$/i }).click();
}

async function main() {
  requireEnv("POKERWEB_PASSWORD", config.password);

  const launchOptions = {
    headless: config.headless,
    viewport: { width: 1280, height: 900 },
    args: [
      "--disable-features=PasswordManagerOnboarding,PasswordManagerSaving",
      "--disable-save-password-bubble",
    ],
  };

  if (config.browserChannel) {
    launchOptions.channel = config.browserChannel;
  }

  const context = await chromium.launchPersistentContext(config.profileDir, launchOptions);
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    await page.goto(config.url, { waitUntil: "domcontentloaded" });

    if (await looksLoggedIn(page)) {
      console.log(`Already logged in: ${page.url()}`);
      return;
    }

    const username = await promptForUsername();
    if (!username) {
      throw new Error("Username is required.");
    }

    await page.getByPlaceholder(/usu[aá]rio/i).fill(username);
    await page.getByPlaceholder(/senha/i).fill(config.password);
    await clickEntrar(page);

    const codeField = page.getByPlaceholder(/c[oó]digo/i);
    await Promise.race([
      page.waitForURL((url) => !url.pathname.includes("/usuarios/login"), { timeout: 20000 }).catch(() => null),
      codeField.waitFor({ state: "visible", timeout: 20000 }).catch(() => null),
    ]);

    if (await looksLoggedIn(page)) {
      console.log(`Login succeeded: ${page.url()}`);
      return;
    }

    for (let attempt = 1; attempt <= config.maxTwoFactorAttempts; attempt += 1) {
      const code = await promptForCode(attempt);
      if (!/^\d{6}$/.test(code)) {
        throw new Error("2FA code must be exactly 6 digits.");
      }

      await codeField.fill(code);
      await clickEntrar(page);

      await Promise.race([
        page.waitForURL((url) => !url.pathname.includes("/usuarios/login"), { timeout: 10000 }).catch(() => null),
        page.getByText(/c[oó]digo inv[aá]lido/i).waitFor({ state: "visible", timeout: 10000 }).catch(() => null),
      ]);

      if (await looksLoggedIn(page)) {
        console.log(`Login succeeded: ${page.url()}`);
        return;
      }

      if (config.twoFactorCode) {
        throw new Error("Provided POKERWEB_2FA_CODE was rejected.");
      }

      console.error("2FA code was rejected. Request a fresh code.");
    }

    throw new Error("Login did not complete after the allowed 2FA attempts.");
  } catch (error) {
    const screenshotPath = path.join(ensureArtifactsDir(), "pokerweb-login-failure.png");
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    console.error(`Login failed: ${error.message}`);
    console.error(`Failure screenshot: ${screenshotPath}`);
    exit(1);
  } finally {
    if (process.env.POKERWEB_KEEP_BROWSER_OPEN !== "true") {
      await context.close();
    }
  }
}

main();

