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

export type LedgerKind = "FUND" | "LABOUR" | "MATERIAL" | "EXPENSE" | "CONTRACT" | "RECEIVED";

export type LedgerEntry = {
  key: string;
  partnerId: number | null; // null = project fund / outside source
  date: string;
  kind: LedgerKind;
  what: string; // e.g. "Cement – 50 bag (Sharma Traders)"
  amount: number; // always positive; RECEIVED is subtracted from contribution
  mode: string;
  note: string | null;
  href?: string;
};

export const LEDGER_KINDS: { kind: LedgerKind; label: string }[] = [
  { kind: "FUND", label: "Put in fund" },
  { kind: "LABOUR", label: "Labour" },
  { kind: "MATERIAL", label: "Materials" },
  { kind: "CONTRACT", label: "Contracts" },
  { kind: "EXPENSE", label: "Expenses" },
  { kind: "RECEIVED", label: "Received (kept)" },
];

/** Every single money entry of a site, tagged with the partner who paid / put it in. Newest first. */
export async function getPartnerLedger(siteId: number): Promise<LedgerEntry[]> {
  const [inv, lab, mat, exp, deal] = await Promise.all([
    prisma.investment.findMany({ where: { siteId } }),
    prisma.labourPayment.findMany({ where: { siteId }, include: { worker: { select: { id: true, name: true, role: true } } } }),
    prisma.materialPayment.findMany({ where: { siteId }, include: { purchase: { select: { material: true, quantity: true, unit: true, supplier: true } } } }),
    prisma.expense.findMany({ where: { siteId } }),
    prisma.dealPayment.findMany({ where: { siteId, status: "PAID" }, include: { deal: { select: { id: true, title: true, party: true, direction: true } } } }),
  ]);

  const entries: LedgerEntry[] = [
    ...inv.map((i) => ({
      key: `i${i.id}`, partnerId: i.paidById, date: i.date, kind: "FUND" as const,
      what: i.paidById ? "Put into project fund" : `Put into project fund – ${i.source}`,
      amount: i.amount, mode: i.mode, note: i.note,
    })),
    ...lab.map((p) => ({
      key: `l${p.id}`, partnerId: p.paidById, date: p.date, kind: "LABOUR" as const,
      what: `${p.worker.name} (${p.worker.role})${p.type !== "DAILY" ? ` – ${p.type.toLowerCase()}` : ""}`,
      amount: p.amount, mode: p.mode, note: p.note, href: `/workers/${p.worker.id}`,
    })),
    ...mat.map((p) => ({
      key: `m${p.id}`, partnerId: p.paidById, date: p.date, kind: "MATERIAL" as const,
      what: `${p.purchase.material} – ${p.purchase.quantity} ${p.purchase.unit}${p.purchase.supplier ? ` (${p.purchase.supplier})` : ""}`,
      amount: p.amount, mode: p.mode, note: p.note, href: "/materials",
    })),
    ...exp.map((e) => ({
      key: `e${e.id}`, partnerId: e.paidById, date: e.date, kind: "EXPENSE" as const,
      what: `${e.category} – ${e.description}${e.paidTo ? ` (to ${e.paidTo})` : ""}`,
      amount: e.amount, mode: e.mode, note: null, href: "/expenses",
    })),
    ...deal.map((p) => ({
      key: `d${p.id}`, partnerId: p.paidById, date: p.date,
      kind: (p.deal.direction === "RECEIVE" ? "RECEIVED" : "CONTRACT") as LedgerKind,
      what: `${p.deal.title} – ${p.deal.party}`,
      amount: p.amount, mode: p.mode, note: p.note, href: `/deals/${p.deal.id}`,
    })),
  ];

  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
