import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./db";

export const SITE_COOKIE = "pms_site";

/** The site the user is currently working on (from cookie), falling back to the first site. */
export const getCurrentSite = cache(async function getCurrentSite() {
  const store = await cookies();
  const id = Number(store.get(SITE_COOKIE)?.value);
  if (id) {
    const site = await prisma.site.findUnique({ where: { id } });
    if (site) return site;
  }
  return prisma.site.findFirst({ orderBy: { id: "asc" } });
});
