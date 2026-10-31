import { cache } from "react";
import { prisma } from "./db";

/** Saved UPI IDs of suppliers / parties on a site, keyed by lower-case name. */
export const getPayeeUpi = cache(async (siteId: number) => {
  const rows = await prisma.payee.findMany({ where: { siteId, upiId: { not: null } }, select: { key: true, upiId: true } });
  return Object.fromEntries(rows.map((r) => [r.key, r.upiId!])) as Record<string, string>;
});

export const upiFor = (map: Record<string, string>, name?: string | null) => (name ? map[name.trim().toLowerCase()] ?? null : null);
