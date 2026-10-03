import "dotenv/config";

const configuredUrl = process.env.STAGING_URL?.trim();
if (!configuredUrl) {
  throw new Error("STAGING_URL is required to test a deployed staging environment.");
}

const baseUrl = configuredUrl.replace(/\/$/, "");
const request = (path: string, init?: RequestInit) => fetch(`${baseUrl}${path}`, {
  ...init,
  signal: AbortSignal.timeout(15_000),
});

const health = await request("/health");
if (health.status !== 200) throw new Error(`/health returned ${health.status}.`);
const healthBody = await health.json() as { status?: string; environment?: string };
if (healthBody.status !== "ok" || !["staging", "production"].includes(healthBody.environment ?? "")) {
  throw new Error("The deployed service did not report a production-like environment.");
}

const healthHeaders = Object.fromEntries(health.headers.entries());
for (const [name, expected] of [
  ["strict-transport-security", "max-age=31536000; includeSubDomains"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "SAMEORIGIN"],
]) {
  if (healthHeaders[name] !== expected) throw new Error(`Missing or invalid ${name} header.`);
}

const readiness = await request("/health/ready");
if (readiness.status !== 200) throw new Error(`/health/ready returned ${readiness.status}.`);
const readinessBody = await readiness.json() as { status?: string };
if (readinessBody.status !== "ready") throw new Error("The deployed service is not database-ready.");

const demo = await request("/api/auth/demo-login", { method: "POST" });
if (demo.status !== 404) throw new Error(`Demo login is exposed with status ${demo.status}.`);

const rejected = await request("/api/auth/logout", {
  method: "POST",
  headers: { Origin: "https://attacker.example" },
});
if (rejected.status !== 403) throw new Error(`Untrusted Origin returned ${rejected.status}.`);

console.log(`Staging smoke test passed for ${baseUrl}.`);
