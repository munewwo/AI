# PokerWeb Login Job

Goal: log in to PokerWeb at `https://japanopt.pokerweb.com.br/usuarios/login/?`, then stop once a post-login page is reached.

Use `scripts/login-pokerweb.cjs` for the browser work. Do not hard-code or persist the username, password, or 2FA code in this repository. The 2FA code is time-sensitive and must come from the user or an approved secret source at runtime.

## What Success Looks Like

The browser reaches a non-login PokerWeb URL. In the observed successful run, the page advanced to:

```text
https://japanopt.pokerweb.com.br/cb
```

## Files

- `scripts/login-pokerweb.cjs`: Playwright login automation.
- `scripts/run-login-pokerweb.sh`: wrapper that uses the bundled Codex Node runtime when available.
- `.env.example`: optional environment variable template.

## Inputs

- `POKERWEB_USERNAME`: optional PokerWeb username. If omitted, the script prompts for it.
- `POKERWEB_PASSWORD`: PokerWeb password. Required. Supply via environment variable or an approved secret source.
- `POKERWEB_2FA_CODE`: optional current 6-digit code. If omitted, the script prompts for it.
- `POKERWEB_URL`: optional login URL override.
- `POKERWEB_PROFILE_DIR`: optional persistent browser profile directory. Defaults to `.pokerweb-profile`.
- `POKERWEB_HEADLESS`: `false` by default so a human or agent can see the flow.

## Recommended Run

Clone the repository, then run from this directory:

```sh
cd runbooks/pokerweb-login
POKERWEB_PASSWORD='ask-user-or-secret-manager' ./scripts/run-login-pokerweb.sh
```

When the script asks for `Username`, request the username from the user and enter it. When it asks for `2FA code`, request the current code from the user and enter it. If the code is rejected as `Codigo invalido`, ask for a fresh code and rerun or let the script prompt again.

## Agent Procedure

1. Confirm the current user instruction allows transmitting the provided credentials to PokerWeb.
2. Run the script with `POKERWEB_PASSWORD` supplied via an environment variable or approved secret source.
3. If the script prompts for the username, ask the user for it.
4. If the script prompts for 2FA, ask the user for the current code. Do not guess from Chrome autofill suggestions.
5. If login succeeds, report the final URL.
6. If login fails, inspect `artifacts/pokerweb-login-failure.png` if it exists and report the visible error.

## Security Notes

- `.env`, `.pokerweb-profile/`, and `artifacts/` are gitignored.
- `.pokerweb-profile/` may contain authenticated session cookies after a successful login.
- Do not click Chrome password-save prompts.
- Do not store passwords, 2FA recovery QR codes, or 2FA seeds in this repository.

