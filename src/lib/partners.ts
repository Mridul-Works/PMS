import { cache } from "react";
import { prisma } from "./db";
import { getCurrentUser } from "./auth";

export type PartnerOption = { id: number; name: string };

/** Partners of a site + the logged-in user's own partner (used as default "Paid by"). */
export const getPartnerContext = cache(async (siteId: number) => {
  const [partners, user] = await Promise.all([
    prisma.partner.findMany({ where: { siteId, active: true }, orderBy: { id: "asc" }, select: { id: true, name: true, userId: true } }),
    getCurrentUser(),
  ]);
  const mine = partners.find((p) => p.userId && p.userId === user?.id);
  return {
    partners: partners.map(({ id, name }) => ({ id, name })) as PartnerOption[],
    defaultId: mine?.id,
  };
});

// ---------------------------------------------------------------------------
// Ledger: every single money entry of a site, tagged with the partner who paid it
// ---------------------------------------------------------------------------

export type LedgerKind = "FUND" | "LABOUR" | "MATERIAL" | "EXPENSE" | "CONTRACT" | "RECEIVED";

export type LedgerEntry = {
  key: string;
  id: number; // row id in its own table
  partnerId: number | null; // null = project fund / outside source
  date: string;
  kind: LedgerKind;
  what: string; // e.g. "Tiles – 200 box (Jai Tiles)"
  amount: number; // always positive; RECEIVED is subtracted from contribution
  mode: string;
  note: string | null;
  enteredBy: string | null; // login user who entered the row
  enteredAt: Date;
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

/** Sum of entries, with money received counted as minus. */
export const ledgerTotal = (entries: LedgerEntry[]) => entries.reduce((s, e) => s + (e.kind === "RECEIVED" ? -e.amount : e.amount), 0);

const by = { select: { name: true } } as const;

type BaseRow = { id: number; paidById: number | null; date: string; amount: number; mode: string; createdAt: Date; createdBy: { name: string } | null };
const base = (r: BaseRow) => ({
  id: r.id,
  partnerId: r.paidById,
  date: r.date,
  amount: r.amount,
  mode: r.mode,
  enteredBy: r.createdBy?.name ?? null,
  enteredAt: r.createdAt,
});

/** All money entries of a site, newest first. Cached per request. */
export const getPartnerLedger = cache(async (siteId: number): Promise<LedgerEntry[]> => {
  const [inv, lab, mat, exp, deal] = await Promise.all([
    prisma.investment.findMany({ where: { siteId }, include: { createdBy: by } }),
    prisma.labourPayment.findMany({ where: { siteId }, include: { createdBy: by, worker: { select: { id: true, name: true, role: true } } } }),
    prisma.materialPayment.findMany({
      where: { siteId },
      include: { createdBy: by, purchase: { select: { material: true, quantity: true, unit: true, supplier: true } } },
    }),
    prisma.expense.findMany({ where: { siteId }, include: { createdBy: by } }),
    prisma.dealPayment.findMany({
      where: { siteId, status: "PAID" },
      include: { createdBy: by, deal: { select: { id: true, title: true, party: true, direction: true } } },
    }),
  ]);

  const entries: LedgerEntry[] = [
    ...inv.map((i) => ({
      ...base(i),
      key: `i${i.id}`,
      kind: "FUND" as const,
      note: i.note,
      what: i.paidById ? "Put into project fund" : `Put into project fund – ${i.source}`,
    })),
    ...lab.map((p) => ({
      ...base(p),
      key: `l${p.id}`,
      kind: "LABOUR" as const,
      note: p.note,
      href: `/workers/${p.worker.id}`,
      what: `${p.worker.name} (${p.worker.role})${p.type !== "DAILY" ? ` – ${p.type.toLowerCase()}` : ""}`,
    })),
    ...mat.map((p) => ({
      ...base(p),
      key: `m${p.id}`,
      kind: "MATERIAL" as const,
      note: p.note,
      href: "/materials",
      what: `${p.purchase.material} – ${p.purchase.quantity} ${p.purchase.unit}${p.purchase.supplier ? ` (${p.purchase.supplier})` : ""}`,
    })),
    ...exp.map((e) => ({
      ...base(e),
      key: `e${e.id}`,
      kind: "EXPENSE" as const,
      note: null,
      href: "/expenses",
      what: `${e.category} – ${e.description}${e.paidTo ? ` (to ${e.paidTo})` : ""}`,
    })),
    ...deal.map((p) => ({
      ...base(p),
      key: `d${p.id}`,
      kind: (p.deal.direction === "RECEIVE" ? "RECEIVED" : "CONTRACT") as LedgerKind,
      note: p.note,
      href: `/deals/${p.deal.id}`,
      what: `${p.deal.title} – ${p.deal.party}`,
    })),
  ];

  return entries.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.enteredAt.getTime() - a.enteredAt.getTime()));
});

// ---------------------------------------------------------------------------
// Report: who put in how much, and who owes whom to match the agreed shares
// ---------------------------------------------------------------------------

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

/** Built from the same (cached) ledger, so a page using both does the DB reads only once. */
export const getPartnerReport = cache(async (siteId: number) => {
  const [partners, ledger] = await Promise.all([
    prisma.partner.findMany({ where: { siteId }, orderBy: { id: "asc" } }),
    getPartnerLedger(siteId),
  ]);

  const sumOf = (id: number | null, kind: LedgerKind) => ledger.reduce((s, e) => (e.partnerId === id && e.kind === kind ? s + e.amount : s), 0);

  const shareTotal = partners.reduce((s, p) => s + p.sharePct, 0);
  const rows: PartnerRow[] = partners.map((p) => {
    const r = {
      fundsIn: sumOf(p.id, "FUND"),
      labour: sumOf(p.id, "LABOUR"),
      material: sumOf(p.id, "MATERIAL"),
      expense: sumOf(p.id, "EXPENSE"),
      contract: sumOf(p.id, "CONTRACT"),
      received: sumOf(p.id, "RECEIVED"),
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
    externalFunds: sumOf(null, "FUND"), // e.g. bank loan
    fromFund: sumOf(null, "LABOUR") + sumOf(null, "MATERIAL") + sumOf(null, "EXPENSE") + sumOf(null, "CONTRACT"),
  };
});
