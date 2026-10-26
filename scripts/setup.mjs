// Creates .env on first setup (database path + a random secret for login sessions).
// Safe to run again: it never overwrites an existing value.
import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";

const file = ".env";
let env = existsSync(file) ? readFileSync(file, "utf8") : "";
const add = [];

if (!/^DATABASE_URL=/m.test(env)) add.push('DATABASE_URL="file:./dev.db"');
const secret = env.match(/^AUTH_SECRET="?([^"\n]*)"?/m)?.[1];
if (!secret || secret.startsWith("change-me")) {
  env = env.replace(/^AUTH_SECRET=.*\n?/m, "");
  add.push(`AUTH_SECRET="${randomBytes(32).toString("hex")}"`);
}

if (add.length) {
  writeFileSync(file, (env && !env.endsWith("\n") ? env + "\n" : env) + add.join("\n") + "\n");
  console.log("Updated .env:", add.map((l) => l.split("=")[0]).join(", "));
} else {
  console.log(".env is ready");
}
