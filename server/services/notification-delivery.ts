import { findUserById } from "../repositories/users";

type DeliveryInput = { userId: string; title: string; text: string };
type IdentifierDeliveryInput = { identifier: string; title: string; text: string };
const DELIVERY_TIMEOUT_MS = 10_000;

async function sendEmail(identifier: string, title: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [identifier], subject: title, text }),
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
  return true;
}

async function sendSms(identifier: string, title: string, text: string) {
  const webhookUrl = process.env.SMS_PROVIDER_WEBHOOK_URL;
  if (!webhookUrl) return false;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.SMS_PROVIDER_AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.SMS_PROVIDER_AUTH_TOKEN}`;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ to: identifier, message: `${title}\n${text}` }),
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`SMS provider returned ${response.status}.`);
  return true;
}

async function deliverToIdentifier(input: IdentifierDeliveryInput) {
  if (input.identifier.includes("@")) {
    return sendEmail(input.identifier, input.title, input.text);
  }
  return sendSms(input.identifier, input.title, input.text);
}

async function deliver(input: DeliveryInput) {
  const user = await findUserById(input.userId);
  if (!user) return;
  return deliverToIdentifier({ identifier: user.identifier, title: input.title, text: input.text });
}

export function dispatchUserNotification(input: DeliveryInput) {
  void deliver(input).catch((error) => {
    console.error("External notification delivery failed.", error);
  });
}

export function dispatchIdentifierNotification(input: IdentifierDeliveryInput) {
  void deliverToIdentifier(input).catch((error) => {
    console.error("External identifier notification delivery failed.", error);
  });
}
