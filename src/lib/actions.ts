"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getCurrentSite, SITE_COOKIE } from "./site";
import { isDate, shiftDay, today } from "./format";

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

/** Reads `<prefix>` value + `<prefix>Unit` (RS | PCT). PCT is converted using `total`. */
function amountOf(f: FormData, prefix: string, total: number) {
  const v = numVal(f, prefix);
  const unit = str(f, `${prefix}Unit`);
  const amt = unit === "PCT" ? (total * v) / 100 : v;
  return Math.round(amt * 100) / 100;
}

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
  const paid = paidRaw === "" ? total : Math.min(total, amountOf(f, "paid", total));
  const mode = str(f, "mode") || "CASH";
  const date = dateVal(f);
  const sid = await siteId();
  const purchase = await prisma.materialPurchase.create({
    data: {
      siteId: sid,
      date,
      material,
      quantity,
      unit: str(f, "unit") || "lot",
      rate: rate || (quantity ? total / quantity : 0),
      total,
      paid,
      mode,
      supplier: optStr(f, "supplier"),
      billNo: optStr(f, "billNo"),
      note: optStr(f, "note"),
    },
  });
  if (paid > 0)
    await prisma.materialPayment.create({ data: { siteId: sid, purchaseId: purchase.id, date, amount: paid, mode, note: "At purchase" } });
  refresh();
}

/** Record a further payment against a material bill (clearing supplier dues). */
export async function payMaterialDue(f: FormData) {
  const id = numVal(f, "id");
  const m = await prisma.materialPurchase.findUnique({ where: { id } });
  if (!m) return;
  const amount = Math.min(m.total - m.paid, amountOf(f, "amount", m.total));
  if (amount <= 0) return;
  await prisma.$transaction([
    prisma.materialPayment.create({
      data: { siteId: m.siteId, purchaseId: id, date: dateVal(f), amount, mode: str(f, "mode") || "CASH", note: optStr(f, "note") },
    }),
    prisma.materialPurchase.update({ where: { id }, data: { paid: m.paid + amount } }),
  ]);
  refresh();
}

export async function deleteMaterialPayment(f: FormData) {
  const p = await prisma.materialPayment.findUnique({ where: { id: numVal(f, "id") } });
  if (!p) return;
  await prisma.$transaction([
    prisma.materialPayment.delete({ where: { id: p.id } }),
    prisma.materialPurchase.update({ where: { id: p.purchaseId }, data: { paid: { decrement: p.amount } } }),
  ]);
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

// ---------- deals: total amount paid / received in parts ----------
export async function addDeal(f: FormData) {
  const totalAmount = numVal(f, "totalAmount");
  const party = str(f, "party");
  if (!totalAmount || !party) return;
  const sid = await siteId();
  const date = dateVal(f);
  const deal = await prisma.deal.create({
    data: {
      siteId: sid,
      direction: str(f, "direction") === "RECEIVE" ? "RECEIVE" : "PAY",
      party,
      title: str(f, "title") || party,
      category: str(f, "category") || "Other",
      totalAmount,
      date,
      note: optStr(f, "note"),
    },
  });

  // first payment now (advance) – in rupees or %
  const first = Math.min(totalAmount, amountOf(f, "first", totalAmount));
  const mode = str(f, "mode") || "CASH";
  const rows: { date: string; amount: number; status: string; mode: string; note?: string }[] = [];
  if (first > 0) rows.push({ date, amount: first, status: "PAID", mode, note: "Advance" });

  // optionally split the rest into N planned installments
  const n = Math.min(60, Math.max(0, Math.floor(numVal(f, "planCount"))));
  if (n > 0) {
    const every = Math.max(1, Math.floor(numVal(f, "planEvery")) || 30);
    const start = isDate(str(f, "planStart")) ? str(f, "planStart") : shiftDay(date, every);
    const rest = totalAmount - first;
    const part = Math.floor((rest / n) * 100) / 100;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? Math.round((rest - part * (n - 1)) * 100) / 100 : part;
      if (amount > 0) rows.push({ date: shiftDay(start, i * every), amount, status: "PLANNED", mode, note: `Installment ${i + 1} of ${n}` });
    }
  }
  if (rows.length)
    await prisma.dealPayment.createMany({ data: rows.map((r) => ({ ...r, siteId: sid, dealId: deal.id })) });
  refresh();
  redirect(`/deals/${deal.id}`);
}

export async function updateDeal(f: FormData) {
  const id = numVal(f, "id");
  await prisma.deal.update({
    where: { id },
    data: {
      party: str(f, "party"),
      title: str(f, "title"),
      category: str(f, "category"),
      totalAmount: numVal(f, "totalAmount"),
      date: dateVal(f),
      note: optStr(f, "note"),
    },
  });
  refresh();
}

export async function deleteDeal(f: FormData) {
  await prisma.deal.delete({ where: { id: numVal(f, "id") } });
  refresh();
  redirect("/deals");
}

/** Once a deal is fully paid/received, leftover planned reminders are no longer needed. */
async function clearPlannedIfSettled(dealId: number) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { payments: true } });
  if (!deal) return;
  const done = deal.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  if (done >= deal.totalAmount - 0.5) await prisma.dealPayment.deleteMany({ where: { dealId, status: "PLANNED" } });
}

export async function addDealPayment(f: FormData) {
  const deal = await prisma.deal.findUnique({ where: { id: numVal(f, "dealId") } });
  if (!deal) return;
  const amount = amountOf(f, "amount", deal.totalAmount);
  if (amount <= 0) return;
  await prisma.dealPayment.create({
    data: {
      siteId: deal.siteId,
      dealId: deal.id,
      date: dateVal(f),
      amount,
      mode: str(f, "mode") || "CASH",
      status: str(f, "status") === "PLANNED" ? "PLANNED" : "PAID",
      note: optStr(f, "note"),
    },
  });
  await clearPlannedIfSettled(deal.id);
  refresh();
}

/** Turn a planned installment into a done one (amount / date / mode can be adjusted). */
export async function completeDealPayment(f: FormData) {
  const id = numVal(f, "id");
  const amount = numVal(f, "amount");
  const p = await prisma.dealPayment.update({
    where: { id },
    data: { status: "PAID", date: dateVal(f), mode: str(f, "mode") || "CASH", ...(amount > 0 ? { amount } : {}) },
  });
  await clearPlannedIfSettled(p.dealId);
  refresh();
}

export async function deleteDealPayment(f: FormData) {
  await prisma.dealPayment.delete({ where: { id: numVal(f, "id") } });
  refresh();
}
