"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getCurrentSite, SITE_COOKIE } from "./site";
import { getCurrentUser, requireAdmin } from "./auth";
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

/** Partner chosen in a "Paid by" dropdown; null = project fund. */
const paidBy = (f: FormData) => {
  const n = Number(str(f, "paidById"));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * "Paid by" + "entered by" for a new payment row.
 * If the form had no "Paid by" dropdown (e.g. no partners existed when the page was opened),
 * the payment is credited to the logged-in user's own partner on that site, if they have one.
 */
async function who(f: FormData, sid: number) {
  const user = await getCurrentUser();
  let paidById = paidBy(f);
  if (!f.has("paidById") && user) {
    const mine = await prisma.partner.findFirst({ where: { siteId: sid, userId: user.id, active: true }, select: { id: true } });
    paidById = mine?.id ?? null;
  }
  return { paidById, createdById: user?.id ?? null };
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
    startDate: new Date(isDate(str(f, "startDate")) ? str(f, "startDate") : today()),
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
  await requireAdmin();
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
  const sid = await siteId();
  await prisma.labourPayment.create({
    data: {
      siteId: sid,
      workerId,
      amount,
      date: dateVal(f),
      type: str(f, "type") || "DAILY",
      mode: str(f, "mode") || "CASH",
      note: optStr(f, "note"),
      ...(await who(f, sid)),
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
    await prisma.materialPayment.create({ data: { siteId: sid, purchaseId: purchase.id, date, amount: paid, mode, note: "At purchase", ...(await who(f, sid)) } });
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
      data: { siteId: m.siteId, purchaseId: id, date: dateVal(f), amount, mode: str(f, "mode") || "CASH", note: optStr(f, "note"), ...(await who(f, m.siteId)) },
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
  const sid = await siteId();
  await prisma.expense.create({
    data: {
      siteId: sid,
      date: dateVal(f),
      category: str(f, "category") || "Miscellaneous",
      description: str(f, "description") || str(f, "category"),
      amount,
      mode: str(f, "mode") || "CASH",
      paidTo: optStr(f, "paidTo"),
      ...(await who(f, sid)),
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
  const partnerId = paidBy(f);
  const partner = partnerId ? await prisma.partner.findUnique({ where: { id: partnerId } }) : null;
  const user = await getCurrentUser();
  await prisma.investment.create({
    data: {
      siteId: await siteId(),
      createdById: user?.id ?? null,
      paidById: partner?.id ?? null,
      date: dateVal(f),
      source: partner?.name || str(f, "source") || "Owner",
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
  const { paidById: by, createdById } = await who(f, sid);
  const rows: { date: string; amount: number; status: string; mode: string; note?: string; paidById?: number | null }[] = [];
  if (first > 0) rows.push({ date, amount: first, status: "PAID", mode, note: "Advance", paidById: by });

  // optionally split the rest into N planned installments
  const n = Math.min(60, Math.max(0, Math.floor(numVal(f, "planCount"))));
  if (n > 0) {
    const every = Math.max(1, Math.floor(numVal(f, "planEvery")) || 30);
    const start = isDate(str(f, "planStart")) ? str(f, "planStart") : shiftDay(date, every);
    const rest = totalAmount - first;
    const part = Math.floor((rest / n) * 100) / 100;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? Math.round((rest - part * (n - 1)) * 100) / 100 : part;
      if (amount > 0) rows.push({ date: shiftDay(start, i * every), amount, status: "PLANNED", mode, note: `Installment ${i + 1} of ${n}`, paidById: by });
    }
  }
  if (rows.length)
    await prisma.dealPayment.createMany({ data: rows.map((r) => ({ ...r, siteId: sid, dealId: deal.id, createdById })) });
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
      ...(await who(f, deal.siteId)),
    },
  });
  await clearPlannedIfSettled(deal.id);
  refresh();
}

/** Turn a planned installment into a done one (amount / date / mode can be adjusted). */
export async function completeDealPayment(f: FormData) {
  const id = numVal(f, "id");
  const amount = numVal(f, "amount");
  const existing = await prisma.dealPayment.findUnique({ where: { id }, select: { siteId: true, createdById: true } });
  if (!existing) return;
  const w = await who(f, existing.siteId);
  const p = await prisma.dealPayment.update({
    where: { id },
    data: {
      status: "PAID",
      date: dateVal(f),
      mode: str(f, "mode") || "CASH",
      paidById: w.paidById,
      createdById: existing.createdById ?? w.createdById,
      ...(amount > 0 ? { amount } : {}),
    },
  });
  await clearPlannedIfSettled(p.dealId);
  refresh();
}

export async function deleteDealPayment(f: FormData) {
  await prisma.dealPayment.delete({ where: { id: numVal(f, "id") } });
  refresh();
}

// ---------- partners / investors ----------
export async function savePartner(f: FormData) {
  await requireAdmin();
  const id = numVal(f, "id");
  const name = str(f, "name");
  if (!name) return;
  const userId = numVal(f, "userId") || null;
  const data = {
    name,
    sharePct: Math.max(0, Math.min(100, numVal(f, "sharePct"))),
    phone: optStr(f, "phone"),
    userId,
    active: id ? f.get("active") === "on" : true,
  };
  if (id) await prisma.partner.update({ where: { id }, data });
  else await prisma.partner.create({ data: { ...data, siteId: await siteId() } });
  refresh();
}

/** Removing a partner keeps the payments; they become "project fund". */
export async function deletePartner(f: FormData) {
  await requireAdmin();
  await prisma.partner.delete({ where: { id: numVal(f, "id") } });
  refresh();
}

/** Admin: change who paid an existing entry (used to assign old "Project fund" entries to a partner). */
export async function setPaidBy(f: FormData) {
  await requireAdmin();
  const id = numVal(f, "id");
  const raw = str(f, "paidById");
  const kind = str(f, "kind");
  if (!id) return;
  const sid = await siteId();
  let paidById: number | null = null;
  if (raw) {
    const partner = await prisma.partner.findFirst({ where: { id: Number(raw), siteId: sid }, select: { id: true, name: true } });
    if (!partner) return;
    paidById = partner.id;
  }
  const where = { id, siteId: sid };
  const data = { paidById };
  if (kind === "LABOUR") await prisma.labourPayment.updateMany({ where, data });
  else if (kind === "MATERIAL") await prisma.materialPayment.updateMany({ where, data });
  else if (kind === "EXPENSE") await prisma.expense.updateMany({ where, data });
  else if (kind === "CONTRACT" || kind === "RECEIVED") await prisma.dealPayment.updateMany({ where, data });
  else if (kind === "FUND") {
    const partner = paidById ? await prisma.partner.findUnique({ where: { id: paidById }, select: { name: true } }) : null;
    await prisma.investment.updateMany({ where, data: { paidById, ...(partner ? { source: partner.name } : {}) } });
  }
  refresh();
}

/** Admin: add every active login user as a partner of the current site (skips ones already added). */
export async function addUsersAsPartners() {
  await requireAdmin();
  const sid = await siteId();
  const [users, existing] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { id: "asc" }, select: { id: true, name: true } }),
    prisma.partner.findMany({ where: { siteId: sid }, select: { userId: true } }),
  ]);
  const have = new Set(existing.map((p) => p.userId));
  const add = users.filter((u) => !have.has(u.id));
  if (add.length)
    await prisma.partner.createMany({
      data: add.map((u) => ({ siteId: sid, userId: u.id, name: u.name.charAt(0).toUpperCase() + u.name.slice(1) })),
    });
  refresh();
}
