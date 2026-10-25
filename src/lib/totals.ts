import { prisma } from "./db";
import { workerBalances } from "./calc";

/** All the money numbers for one site. */
export async function getTotals(siteId: number) {
  const [workers, attendance, payments, materials, expenses, funds] = await Promise.all([
    prisma.worker.findMany({ where: { siteId }, select: { id: true, dailyWage: true } }),
    prisma.attendance.findMany({ where: { siteId }, select: { workerId: true, status: true, overtime: true } }),
    prisma.labourPayment.findMany({ where: { siteId }, select: { workerId: true, amount: true, mode: true, date: true } }),
    prisma.materialPurchase.findMany({ where: { siteId }, select: { total: true, paid: true, mode: true, date: true, material: true } }),
    prisma.expense.findMany({ where: { siteId }, select: { amount: true, mode: true, date: true, category: true } }),
    prisma.investment.aggregate({ where: { siteId }, _sum: { amount: true } }),
  ]);

  const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0);

  const balances = [...workerBalances(workers, attendance, payments).values()];
  const labourPaid = sum(payments, (p) => p.amount);
  const labourDue = sum(balances.filter((b) => b.balance > 0), (b) => b.balance);
  const labourAdvance = sum(balances.filter((b) => b.balance < 0), (b) => -b.balance);
  const materialCost = sum(materials, (m) => m.total);
  const materialPaid = sum(materials, (m) => m.paid);
  const expenseTotal = sum(expenses, (e) => e.amount);

  // Cost = what the work has cost so far (labour paid + materials bought + expenses)
  const totalCost = labourPaid + materialCost + expenseTotal;
  // Cash out = money that actually left your pocket
  const cashOut = labourPaid + materialPaid + expenseTotal;

  const byMode: Record<string, number> = { CASH: 0, GPAY: 0, BANK: 0 };
  for (const p of payments) byMode[p.mode] = (byMode[p.mode] ?? 0) + p.amount;
  for (const m of materials) byMode[m.mode] = (byMode[m.mode] ?? 0) + m.paid;
  for (const e of expenses) byMode[e.mode] = (byMode[e.mode] ?? 0) + e.amount;

  // monthly cost split
  const monthly = new Map<string, { labour: number; material: number; other: number }>();
  const bump = (date: string, key: "labour" | "material" | "other", v: number) => {
    const m = date.slice(0, 7);
    const row = monthly.get(m) ?? { labour: 0, material: 0, other: 0 };
    row[key] += v;
    monthly.set(m, row);
  };
  payments.forEach((p) => bump(p.date, "labour", p.amount));
  materials.forEach((m) => bump(m.date, "material", m.total));
  expenses.forEach((e) => bump(e.date, "other", e.amount));

  return {
    labourPaid,
    labourDue,
    labourAdvance,
    materialCost,
    materialPaid,
    materialDue: materialCost - materialPaid,
    expenseTotal,
    totalCost,
    cashOut,
    fundsIn: funds._sum.amount ?? 0,
    byMode,
    monthly,
  };
}
