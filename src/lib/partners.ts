import { prisma } from "./db";
import { getCurrentUser } from "./auth";

export type PartnerOption = { id: number; name: string };

/** Partners of a site + the logged-in user's own partner (used as default "Paid by"). */
export async function getPartnerContext(siteId: number) {
  const [partners, user] = await Promise.all([
    prisma.partner.findMany({ where: { siteId, active: true }, orderBy: { id: "asc" }, select: { id: true, name: true, userId: true } }),
    getCurrentUser(),
  ]);
  const mine = partners.find((p) => p.userId && p.userId === user?.id);
  return {
    partners: partners.map(({ id, name }) => ({ id, name })) as PartnerOption[],
    defaultId: mine?.id,
  };
}

export type PartnerRow = {
  id: number;
  name: string;
  sharePct: number;
  userId: number | null;
  phone: string | null;
  active: boolean;
  fundsIn: number; // money put into the project fund
  labour: number; // paid directly from own pocket…
  material: number;
  expense: number;
  contract: number;
  received: number; // money received from clients that this partner kept
  net: number; // total contribution = fundsIn + direct payments − received
  share: number; // agreed share as a fraction (0–1)
  expected: number; // what they should have contributed by their share
  diff: number; // + put in more than share, − less
};

/** Who put in how much, and who owes whom to match the agreed shares. */
export async function getPartnerReport(siteId: number) {
  const [partners, inv, lab, mat, exp, deal] = await Promise.all([
    prisma.partner.findMany({ where: { siteId }, orderBy: { id: "asc" } }),
    prisma.investment.groupBy({ by: ["paidById"], where: { siteId }, _sum: { amount: true } }),
    prisma.labourPayment.groupBy({ by: ["paidById"], where: { siteId }, _sum: { amount: true } }),
    prisma.materialPayment.groupBy({ by: ["paidById"], where: { siteId }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["paidById"], where: { siteId }, _sum: { amount: true } }),
    prisma.dealPayment.findMany({ where: { siteId, status: "PAID" }, select: { paidById: true, amount: true, deal: { select: { direction: true } } } }),
  ]);
  const pick = (rows: { paidById: number | null; _sum: { amount: number | null } }[], id: number | null) =>
    rows.find((r) => r.paidById === id)?._sum.amount ?? 0;
  const dealSum = (id: number | null, dir: string) =>
    deal.filter((d) => d.paidById === id && d.deal.direction === dir).reduce((s, d) => s + d.amount, 0);

  const shareTotal = partners.reduce((s, p) => s + p.sharePct, 0);
  const rows: PartnerRow[] = partners.map((p) => {
    const r = {
      fundsIn: pick(inv, p.id),
      labour: pick(lab, p.id),
      material: pick(mat, p.id),
      expense: pick(exp, p.id),
      contract: dealSum(p.id, "PAY"),
      received: dealSum(p.id, "RECEIVE"),
    };
    const net = r.fundsIn + r.labour + r.material + r.expense + r.contract - r.received;
    const share = shareTotal > 0 ? p.sharePct / shareTotal : 1 / partners.length;
    return { id: p.id, name: p.name, sharePct: p.sharePct, userId: p.userId, phone: p.phone, active: p.active, ...r, net, share, expected: 0, diff: 0 };
  });

  const totalNet = rows.reduce((s, r) => s + r.net, 0);
  for (const r of rows) {
    r.expected = totalNet * r.share;
    r.diff = r.net - r.expected;
  }

  // settle up: those who put in less pay those who put in more
  const settlements: { from: string; to: string; amount: number }[] = [];
  const owe = rows.filter((r) => r.diff < -1).map((r) => ({ name: r.name, amt: -r.diff }));
  const get = rows.filter((r) => r.diff > 1).map((r) => ({ name: r.name, amt: r.diff }));
  for (const o of owe) {
    for (const g of get) {
      if (o.amt < 1) break;
      const x = Math.min(o.amt, g.amt);
      if (x < 1) continue;
      settlements.push({ from: o.name, to: g.name, amount: x });
      o.amt -= x;
      g.amt -= x;
    }
  }

  return {
    rows,
    totalNet,
    sharesSet: shareTotal > 0,
    shareTotal,
    settlements,
    // money not linked to any partner
    externalFunds: pick(inv, null), // e.g. bank loan
    fromFund: pick(lab, null) + pick(mat, null) + pick(exp, null) + dealSum(null, "PAY"),
  };
}
