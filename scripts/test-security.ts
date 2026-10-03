import "dotenv/config";

process.env.NODE_ENV = "staging";
process.env.CLIENT_ORIGIN = "https://zarinsa.test";

const [{ createServer }, { closeDatabase }] = await Promise.all([
  import("../server"),
  import("../server/db"),
]);
const app = createServer();
const server = app.listen(0);
await new Promise<void>((resolve, reject) => {
  server.once("listening", () => resolve());
  server.once("error", reject);
});
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Could not determine the test server port.");
}

const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const health = await fetch(`${baseUrl}/health`);
  if (health.status !== 200) throw new Error(`/health returned ${health.status}.`);
  const healthBody = await health.json() as { status?: string; environment?: string };
  if (healthBody.status !== "ok" || healthBody.environment !== "staging") {
    throw new Error("/health did not report the staging environment correctly.");
  }

  const headers = Object.fromEntries(health.headers.entries());
  if (!/^[0-9a-f-]{36}$/.test(headers["x-request-id"] ?? "")) {
    throw new Error("Health response did not include a valid request ID.");
  }
  for (const [name, value] of [
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "SAMEORIGIN"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["strict-transport-security", "max-age=31536000; includeSubDomains"],
  ]) {
    if (headers[name] !== value) throw new Error(`Missing security header ${name}.`);
  }

  const demo = await fetch(`${baseUrl}/api/auth/demo-login`, { method: "POST" });
  if (demo.status !== 404) throw new Error(`Demo login was exposed in staging with status ${demo.status}.`);

  const rejected = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://attacker.example" },
  });
  if (rejected.status !== 403) throw new Error(`Untrusted Origin returned ${rejected.status}.`);

  const trusted = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: process.env.CLIENT_ORIGIN },
  });
  if (trusted.status === 403) throw new Error("Configured Origin was rejected.");

  console.log("Security smoke test passed: health, headers, and Origin protection.");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeDatabase();
}
