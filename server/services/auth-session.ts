import { createHash } from "node:crypto";
import type { Request } from "express";
import { findSessionUserId } from "../repositories/account";
import { findUserById } from "../repositories/users";

export function hashSessionToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function readSessionToken(req: Request) {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("zarinsa_session="));
  return cookie?.slice("zarinsa_session=".length);
}

export async function getAuthenticatedUser(req: Request) {
  const sessionToken = readSessionToken(req);
  const userId = sessionToken ? await findSessionUserId(hashSessionToken(sessionToken)) : null;
  return userId ? findUserById(userId) : null;
}
