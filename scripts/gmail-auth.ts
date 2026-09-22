import "dotenv/config";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { google } from "googleapis";
import { loadOAuthConfig } from "../lib/config.js";
import { GMAIL_READONLY_SCOPE } from "../lib/gmail.js";

const oauth = loadOAuthConfig();
const redirectUrl = new URL(oauth.redirectUri);

if (
  redirectUrl.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(redirectUrl.hostname)
) {
  throw new Error(
    "For the local OAuth helper, GMAIL_REDIRECT_URI must be an http://localhost callback URL.",
  );
}

const client = new google.auth.OAuth2(
  oauth.clientId,
  oauth.clientSecret,
  oauth.redirectUri,
);
const state = randomBytes(24).toString("hex");
const authorizationUrl = client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [GMAIL_READONLY_SCOPE],
  state,
});

const tokenPath = resolve(process.cwd(), ".gmail-token.json");

await new Promise<void>((resolvePromise, rejectPromise) => {
  const timeout = setTimeout(() => {
    server.close();
    rejectPromise(new Error("OAuth authorization timed out after five minutes"));
  }, 5 * 60 * 1_000);

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", oauth.redirectUri);
      if (requestUrl.pathname !== redirectUrl.pathname) {
        response.writeHead(404).end("Not found");
        return;
      }
      if (requestUrl.searchParams.get("state") !== state) {
        response.writeHead(400).end("Invalid OAuth state");
        throw new Error("OAuth state did not match");
      }
      const providerError = requestUrl.searchParams.get("error");
      if (providerError) {
        response.writeHead(400).end(`Google authorization failed: ${providerError}`);
        throw new Error(`Google authorization failed: ${providerError}`);
      }
      const code = requestUrl.searchParams.get("code");
      if (!code) {
        response.writeHead(400).end("Missing authorization code");
        throw new Error("OAuth callback did not contain a code");
      }

      const { tokens } = await client.getToken(code);
      if (!tokens.refresh_token) {
        response.writeHead(400).end("Google did not return a refresh token");
        throw new Error(
          "Google did not return a refresh token. Revoke the app grant and run gmail:auth again.",
        );
      }

      await writeFile(
        tokenPath,
        `${JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2)}\n`,
        { mode: 0o600 },
      );
      response
        .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Gmail connected. You can close this tab and return to the terminal.");
      clearTimeout(timeout);
      server.close(() => resolvePromise());
    } catch (error) {
      clearTimeout(timeout);
      server.close(() => rejectPromise(error));
    }
  });

  const port = Number(redirectUrl.port || 80);
  server.listen(port, redirectUrl.hostname, () => {
    console.log("\nOpen this URL in your browser to grant read-only Gmail access:\n");
    console.log(authorizationUrl);
    console.log(`\nWaiting for the callback at ${oauth.redirectUri} ...`);
  });
});

console.log(`\nSaved the refresh token to ${tokenPath}`);
