"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { endSession, hashPassword, requireAdmin, requireUser, startSession, verifyPassword } from "./auth";

export type FormState = { error?: string; ok?: string; username?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const cleanUsername = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Only allow redirects to paths inside this app. */
function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function checkPassword(pw: string) {
  if (pw.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export async function login(_: FormState, f: FormData): Promise<FormState> {
  const username = cleanUsername(str(f, "username"));
  const password = String(f.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: "Wrong username or password.", username };
  }
  await startSession(user.id);
  redirect(safeNext(str(f, "next")));
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/** First run only: create the admin account when no users exist yet. */
export async function setupAdmin(_: FormState, f: FormData): Promise<FormState> {
  if ((await prisma.user.count()) > 0) return { error: "Setup is already done. Please log in." };
  const name = str(f, "name");
  const username = cleanUsername(str(f, "username"));
  const password = String(f.get("password") ?? "");
  if (!name || !username) return { error: "Name and username are required." };
  const bad = checkPassword(password);
  if (bad) return { error: bad };
  if (password !== String(f.get("confirm") ?? "")) return { error: "Passwords do not match." };
  const user = await prisma.user.create({ data: { name, username, passwordHash: await hashPassword(password), role: "ADMIN" } });
  await startSession(user.id);
  redirect("/");
}

export async function createUser(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(f, "name");
  const username = cleanUsername(str(f, "username"));
  const password = String(f.get("password") ?? "");
  if (!name || !username) return { error: "Name and username are required." };
  const bad = checkPassword(password);
  if (bad) return { error: bad };
  if (await prisma.user.findUnique({ where: { username } })) return { error: `Username "${username}" is already taken.` };
  await prisma.user.create({
    data: { name, username, passwordHash: await hashPassword(password), role: str(f, "role") === "ADMIN" ? "ADMIN" : "MEMBER" },
  });
  revalidatePath("/users");
  return { ok: `User ${name} created. They can log in as "${username}".` };
}

export async function updateUser(f: FormData) {
  const me = await requireAdmin();
  const id = Number(f.get("id"));
  const role = str(f, "role") === "ADMIN" ? "ADMIN" : "MEMBER";
  const active = f.get("active") === "on";
  // never lock yourself out
  if (id === me.id && (role !== "ADMIN" || !active)) throw new Error("You cannot remove your own admin access.");
  const password = String(f.get("password") ?? "");
  await prisma.user.update({
    where: { id },
    data: {
      name: str(f, "name") || undefined,
      role,
      active,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });
  revalidatePath("/", "layout");
}

export async function deleteUser(f: FormData) {
  const me = await requireAdmin();
  const id = Number(f.get("id"));
  if (id === me.id) throw new Error("You cannot delete yourself.");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function changeMyPassword(_: FormState, f: FormData): Promise<FormState> {
  const me = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(String(f.get("current") ?? ""), user.passwordHash))) return { error: "Current password is wrong." };
  const pw = String(f.get("password") ?? "");
  const bad = checkPassword(pw);
  if (bad) return { error: bad };
  if (pw !== String(f.get("confirm") ?? "")) return { error: "New passwords do not match." };
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(pw) } });
  return { ok: "Password changed." };
}
