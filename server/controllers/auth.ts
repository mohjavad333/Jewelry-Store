import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Request, Response } from "express";
import { challengeSchema, verifySchema, profileSchema, addressSchema } from "../validators/auth";
import { createUser, findUserByIdentifier, updateUserName, type User } from "../repositories/users";
import { createAddress as saveAddress, createAuthChallenge, createSession, deleteAddress as removeAddress, deleteAuthChallenge, deleteSession, findAuthChallenge, findSessionUserId, incrementAuthChallengeAttempts, listAddresses as listUserAddresses, updateAddress as saveUpdatedAddress } from "../repositories/account";
import { dispatchIdentifierNotification } from "../services/notification-delivery";
import { isProductionLikeEnvironment } from "../env";
import { getAuthenticatedUser, hashSessionToken, readSessionToken } from "../services/auth-session";

export type { User } from "../repositories/users";

type Challenge = { identifier: string; mode: "login" | "register"; name?: string; codeHash: string; expiresAt: number; attempts: number };

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const requireUser = async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) { res.status(401).json({ message: "برای ادامه وارد حساب شوید." }); return null; }
  return user;
};
const cookie = (token: string, maxAge: number) => `zarinsa_session=${token}; HttpOnly; Path=/; SameSite=Lax${isProductionLikeEnvironment() ? "; Secure" : ""}; Max-Age=${maxAge}`;

export async function requestAuthCode(req: Request, res: Response) {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات ورود معتبر نیست." });
  const { identifier, mode, name } = parsed.data;
  if (mode === "register" && !name) return res.status(400).json({ message: "نام و نام خانوادگی الزامی است." });
  const existing = await findUserByIdentifier(identifier);
  if (mode === "login" && !existing) return res.status(404).json({ message: "حسابی با این راه ارتباطی پیدا نشد." });
  const code = String(randomInt(100000, 1000000));
  const challengeId = randomBytes(18).toString("hex");
  const challenge: Challenge = { identifier, mode, name, codeHash: hash(code), expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 };
  await createAuthChallenge({ id: challengeId, ...challenge });
  dispatchIdentifierNotification({ identifier, title: "کد ورود زرین‌سا", text: `کد تأیید شما: ${code}\nاین کد تا ۵ دقیقه معتبر است.` });
  res.json({ challengeId, expiresIn: 300, ...(!isProductionLikeEnvironment() ? { devCode: code } : {}) });
}

export async function demoLogin(req: Request, res: Response) {
  if (isProductionLikeEnvironment()) return res.status(404).json({ message: "مسیر ورود دمو در محیط امن فعال نیست." });
  const identifier = "demo@zarinsa.local";
  const user = await findUserByIdentifier(identifier) ?? await createUser({ id: "zarinsa-demo-user", name: "کاربر دمو زرین‌سا", identifier });
  const sessionToken = randomBytes(32).toString("hex");
  await createSession(hash(sessionToken), user.id, new Date(Date.now() + 24 * 60 * 60 * 1000));
  res.setHeader("Set-Cookie", cookie(sessionToken, 60 * 60 * 24));
  res.json({ user, addresses: await listUserAddresses(user.id), demo: true });
}

export async function verifyAuthCode(req: Request, res: Response) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "کد تأیید باید ۶ رقم باشد." });
  const challenge = await findAuthChallenge(parsed.data.challengeId);
  if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) return res.status(400).json({ message: "کد تأیید منقضی شده است." });
  const updatedChallenge = await incrementAuthChallengeAttempts(parsed.data.challengeId);
  if (!updatedChallenge || hash(parsed.data.code) !== updatedChallenge.codeHash) return res.status(400).json({ message: "کد تأیید نادرست است." });
  const existing = await findUserByIdentifier(updatedChallenge.identifier);
  const user = existing ?? await createUser({ id: randomBytes(12).toString("hex"), name: updatedChallenge.name || "کاربر زرین‌سا", identifier: updatedChallenge.identifier });
  const sessionToken = randomBytes(32).toString("hex");
  await createSession(hash(sessionToken), user.id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  await deleteAuthChallenge(parsed.data.challengeId);
  res.setHeader("Set-Cookie", cookie(sessionToken, 60 * 60 * 24 * 30));
  res.json({ user, addresses: await listUserAddresses(user.id) });
}

export async function updateProfile(req: Request, res: Response) {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "نام واردشده معتبر نیست." });
  const updated = await updateUserName(user.id, parsed.data.name);
  if (!updated) return res.status(404).json({ message: "کاربر پیدا نشد." });
  res.json({ user: updated });
}

export async function getCurrentUser(req: Request, res: Response) {
  const user = await requireUser(req, res);
  if (user) res.json({ user, addresses: await listUserAddresses(user.id) });
}

export async function logout(req: Request, res: Response) {
  const token = readSessionToken(req);
  if (token) await deleteSession(hashSessionToken(token));
  res.setHeader("Set-Cookie", cookie("", 0));
  res.status(204).end();
}

export async function listAddresses(req: Request, res: Response) {
  const user = await requireUser(req, res);
  if (user) res.json({ addresses: await listUserAddresses(user.id) });
}

export async function createAddress(req: Request, res: Response) {
  const user = await requireUser(req, res);
  const parsed = addressSchema.safeParse(req.body);
  if (!user) return;
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات آدرس کامل نیست." });
  const input = parsed.data as Omit<import("../repositories/account").Address, "id">;
  const address = await saveAddress(user.id, input);
  res.status(201).json({ address });
}

export async function updateAddress(req: Request, res: Response) {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات آدرس کامل نیست." });
  const address = await saveUpdatedAddress(user.id, String(req.params.id), parsed.data as Omit<import("../repositories/account").Address, "id">);
  if (!address) return res.status(404).json({ message: "آدرس پیدا نشد." });
  res.json({ address });
}

export async function deleteAddress(req: Request, res: Response) {
  const user = await requireUser(req, res);
  if (!user) return;
  await removeAddress(user.id, String(req.params.id));
  res.status(204).end();
}
