"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getCurrentSite, SITE_COOKIE } from "./site";
import { isDate, today } from "./format";

// ---------- helpers ----------
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optStr = (f: FormData, k: string) => str(f, k) || null;
const numVal = (f: FormData, k: string) => {
  const n = Number(str(f, k));
  return Number.isFinite(n) ? n : 0;
};
const dateVal = (f: FormData, k = "date") => {
  const d = str(f, k);
  return isDate(d) ? d : today();
};

async function siteId() {
  const site = await getCurrentSite();
  if (!site) redirect("/sites");
  return site.id;
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- sites ----------
export async function saveSite(f: FormData) {
  const id = numVal(f, "id");
  const data = {
    name: str(f, "name") || "My Site",
    location: optStr(f, "location"),
    budget: numVal(f, "budget"),
    notes: optStr(f, "notes"),
    startDate: isDate(str(f, "startDate")) ? new Date(str(f, "startDate")) : new Date(),
  };
  const site = id
    ? await prisma.site.update({ where: { id }, data })
    : await prisma.site.create({ data });
  if (!id) (await cookies()).set(SITE_COOKIE, String(site.id), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  refresh();
  if (!id) redirect("/");
}

export async function switchSite(f: FormData) {
  (await cookies()).set(SITE_COOKIE, String(numVal(f, "siteId")), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  refresh();
}

export async function deleteSite(f: FormData) {
  await prisma.site.delete({ where: { id: numVal(f, "id") } });
  (await cookies()).delete(SITE_COOKIE);
  refresh();
}

// ---------- workers ----------
export async function saveWorker(f: FormData) {
  const id = numVal(f, "id");
  const data = {
    name: str(f, "name"),
    phone: optStr(f, "phone"),
    role: str(f, "role") || "Labour",
    dailyWage: numVal(f, "dailyWage"),
    notes: optStr(f, "notes"),
    active: id ? f.get("active") === "on" : true,
  };
  if (!data.name) return;
  if (id) await prisma.worker.update({ where: { id }, data });
  else await prisma.worker.create({ data: { ...data, siteId: await siteId(), joinedAt: new Date(dateVal(f, "joinedAt")) } });
  refresh();
}

export async function deleteWorker(f: FormData) {
  await prisma.worker.delete({ where: { id: numVal(f, "id") } });
  refresh();
  redirect("/workers");
}

// ---------- attendance ----------
/** Form has fields status_<workerId> and ot_<workerId> for one date. */
export async function saveAttendance(f: FormData) {
  const sid = await siteId();
  const date = dateVal(f);
  const ops = [];
  for (const [key, value] of f.entries()) {
    if (!key.startsWith("status_")) continue;
    const workerId = Number(key.slice(7));
    const status = String(value);
    const overtime = numVal(f, `ot_${workerId}`);
    if (status === "NONE") {
      ops.push(prisma.attendance.deleteMany({ where: { workerId, date } }));
    } else {
      ops.push(
        prisma.attendance.upsert({
          where: { workerId_date: { workerId, date } },
          create: { siteId: sid, workerId, date, status, overtime },
          update: { status, overtime },
        }),
      );
    }
  }
  await prisma.$transaction(ops);
  refresh();
}

// ---------- labour payments ----------
export async function addLabourPayment(f: FormData) {
  const amount = numVal(f, "amount");
  const workerId = numVal(f, "workerId");
  if (!amount || !workerId) return;
  await prisma.labourPayment.create({
    data: {
      siteId: await siteId(),
      workerId,
      amount,
      date: dateVal(f),
      type: str(f, "type") || "DAILY",
      mode: str(f, "mode") || "CASH",
      note: optStr(f, "note"),
    },
  });
  refresh();
}

export async function deleteLabourPayment(f: FormData) {
  await prisma.labourPayment.delete({ where: { id: numVal(f, "id") } });
  refresh();
}

// ---------- materials ----------
export async function addMaterial(f: FormData) {
  const quantity = numVal(f, "quantity");
  const rate = numVal(f, "rate");
  const total = numVal(f, "total") || quantity * rate;
  const material = str(f, "material") === "Other" ? str(f, "materialOther") || "Other" : str(f, "material");
  if (!material || !total) return;
  const paidRaw = str(f, "paid");
  await prisma.materialPurchase.create({
    data: {
      siteId: await siteId(),
      date: dateVal(f),
      material,
      quantity,
      unit: str(f, "unit") || "lot",
      rate: rate || (quantity ? total / quantity : 0),
      total,
      paid: paidRaw === "" ? total : numVal(f, "paid"),
      mode: str(f, "mode") || "CASH",
      supplier: optStr(f, "supplier"),
      billNo: optStr(f, "billNo"),
      note: optStr(f, "note"),
    },
  });
  refresh();
}

/** Record a further payment against a material bill (clearing supplier dues). */
export async function payMaterialDue(f: FormData) {
  const id = numVal(f, "id");
  const amount = numVal(f, "amount");
  const m = await prisma.materialPurchase.findUnique({ where: { id } });
  if (!m || amount <= 0) return;
  await prisma.materialPurchase.update({ where: { id }, data: { paid: Math.min(m.total, m.paid + amount) } });
  refresh();
}

export async function deleteMaterial(f: FormData) {
  await prisma.materialPurchase.delete({ where: { id: numVal(f, "id") } });
  refresh();
}

// ---------- other expenses ----------
export async function addExpense(f: FormData) {
  const amount = numVal(f, "amount");
  if (!amount) return;
  await prisma.expense.create({
    data: {
      siteId: await siteId(),
      date: dateVal(f),
      category: str(f, "category") || "Miscellaneous",
      description: str(f, "description") || str(f, "category"),
      amount,
      mode: str(f, "mode") || "CASH",
      paidTo: optStr(f, "paidTo"),
    },
  });
  refresh();
}

export async function deleteExpense(f: FormData) {
  await prisma.expense.delete({ where: { id: numVal(f, "id") } });
  refresh();
}

// ---------- investments (money put into the project) ----------
export async function addInvestment(f: FormData) {
  const amount = numVal(f, "amount");
  if (!amount) return;
  await prisma.investment.create({
    data: {
      siteId: await siteId(),
      date: dateVal(f),
      source: str(f, "source") || "Owner",
      amount,
      mode: str(f, "mode") || "BANK",
      note: optStr(f, "note"),
    },
  });
  refresh();
}

export async function deleteInvestment(f: FormData) {
  await prisma.investment.delete({ where: { id: numVal(f, "id") } });
  refresh();
}
