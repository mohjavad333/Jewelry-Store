import "dotenv/config";

if (process.env.NODE_ENV !== "staging") {
  throw new Error("Staging preflight requires NODE_ENV=staging.");
}

const stagingUrl = process.env.STAGING_URL?.trim();
if (!stagingUrl) throw new Error("STAGING_URL is required for staging preflight.");

let parsedUrl: URL;
try {
  parsedUrl = new URL(stagingUrl);
} catch {
  throw new Error("STAGING_URL must be a valid HTTPS URL.");
}
if (parsedUrl.protocol !== "https:") throw new Error("STAGING_URL must use HTTPS.");

const { validateProductionEnvironment } = await import("../server/env");
validateProductionEnvironment();

console.log(`Staging environment preflight passed for ${parsedUrl.origin}.`);
