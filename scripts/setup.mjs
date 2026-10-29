// Prepares .env: adds a random AUTH_SECRET (login sessions) and checks the database URLs.
// Safe to run again: it never overwrites an existing value.
import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";

const file = ".env";
let env = existsSync(file) ? readFileSync(file, "utf8") : "";
const get = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, "m"))?.[1] ?? "";

// 1. login secret
const secret = get("AUTH_SECRET");
if (!secret || secret.startsWith("change-me")) {
  env = env.replace(/^AUTH_SECRET=.*\n?/m, "");
  env = (env && !env.endsWith("\n") ? env + "\n" : env) + `AUTH_SECRET="${randomBytes(32).toString("hex")}"\n`;
  writeFileSync(file, env);
  console.log("✓ Added a random AUTH_SECRET to .env");
}

// 2. database
const db = get("DATABASE_URL");
const direct = get("DATABASE_URL_UNPOOLED");
const isPg = (u) => /^postgres(ql)?:\/\//.test(u) && !u.includes("USER:PASSWORD");
if (!isPg(db) || !isPg(direct)) {
  console.error(`
✗ Database not configured.
  1. Create a free Postgres database at https://neon.tech
  2. In Neon, click "Connect" and copy the connection strings into .env:
       DATABASE_URL="...pooled string (host has -pooler)..."
       DATABASE_URL_UNPOOLED="...direct string (no -pooler)..."
  3. Run  npm run setup  again.
  (See .env.example for the format.)
`);
  process.exit(1);
}
console.log("✓ .env is ready");
