import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { dealSummary, workerBalances } from "@/lib/calc";
import { modeLabel } from "@/lib/constants";
import { inr, prettyDate, today } from "@/lib/format";
import { supplierHref } from "@/lib/links";
import { getPartnerLedger, LEDGER_KINDS } from "@/lib/partners";
import { Badge, Bar, Card, Empty, PageHeader, Stat } from "@/components/ui";

type Kind = "SUPPLIER" | "CONTRACT" | "LABOUR" | "RECEIVE";
type Item = {
  key: string;
  kind: Kind;
  name: string;
  sub: string;
  total: number;
  done: number;
  remaining: number;
  href: string;
  since: string;
  alert?: string; // e.g. overdue installments
};

const KINDS: { kind: Kind; label: string; color: string }[] = [
  { kind: "SUPPLIER", label: "Suppliers", color: "bg-rose-500" },
  { kind: "CONTRACT", label: "Contracts / deals", color: "bg-orange-500" },
  { kind: "LABOUR", label: "Labour wages", color: "bg-amber-500" },
  { kind: "RECEIVE", label: "To receive", color: "bg-emerald-500" },
];

export default async function DuesPage({ searchParams }: { searchParams: Promise<{ type?: string; show?: string }> }) {
  const sp = await searchParams;
  const site = (await getCurrentSite())!;
  const t = today();
  const showAll = sp.show === "all";
  const type = KINDS.find((k) => k.kind === sp.type)?.kind;

  const [bills, deals, workers, attendance, labourPay, ledger] = await Promise.all([
    prisma.materialPurchase.findMany({ where: { siteId: site.id }, select: { supplier: true, total: true, paid: true, date: true, material: true } }),
    prisma.deal.findMany({ where: { siteId: site.id }, include: { payments: true } }),
    prisma.worker.findMany({ where: { siteId: site.id }, select: { id: true, name: true, role: true, dailyWage: true, joinedAt: true } }),
    prisma.attendance.findMany({ where: { siteId: site.id }, select: { workerId: true, status: true, overtime: true } }),
    prisma.labourPayment.findMany({ where: { siteId: site.id }, select: { workerId: true, amount: true } }),
    getPartnerLedger(site.id),
  ]);

  const items: Item[] = [];

  // suppliers: all bills of one supplier together (names matched ignoring case)
  const bySupplier = new Map<string, { name: string | null; total: number; paid: number; open: number; count: number; since: string; materials: Set<string> }>();
  for (const b of bills) {
    const key = (b.supplier ?? "").trim().toLowerCase();
    const g = bySupplier.get(key) ?? { name: b.supplier?.trim() || null, total: 0, paid: 0, open: 0, count: 0, since: b.date, materials: new Set<string>() };
    g.total += b.total;
    g.paid += b.paid;
    g.count++;
    if (b.total - b.paid > 0.5) g.open++;
    if (b.date < g.since) g.since = b.date;
    g.materials.add(b.material);
    bySupplier.set(key, g);
  }
  for (const [key, g] of bySupplier)
    items.push({
      key: `s:${key}`,
      kind: "SUPPLIER",
      name: g.name ?? "No supplier name",
      sub: `${[...g.materials].join(", ")} · ${g.count} bill(s)${g.open ? ` · ${g.open} open` : ""}`,
      total: g.total,
      done: g.paid,
      remaining: g.total - g.paid,
      href: supplierHref(g.name),
      since: g.since,
    });

  // part-payment deals
  for (const d of deals) {
    const s = dealSummary(d, t);
    items.push({
      key: `d:${d.id}`,
      kind: d.direction === "RECEIVE" ? "RECEIVE" : "CONTRACT",
      name: d.party,
      sub: `${d.title !== d.party ? `${d.title} · ` : ""}${d.category}`,
      total: d.totalAmount,
      done: s.done,
      remaining: s.remaining,
      href: `/deals/${d.id}`,
      since: d.date,
      alert: s.overdue.length ? `${s.overdue.length} overdue · ${inr(s.overdue.reduce((a, p) => a + p.amount, 0))}` : s.nextDue ? `Next ${inr(s.nextDue.amount)} on ${prettyDate(s.nextDue.date)}` : undefined,
    });
  }

  // labour: wages earned but not yet paid
  const balances = workerBalances(workers, attendance, labourPay);
  for (const w of workers) {
    const b = balances.get(w.id)!;
    if (b.earned <= 0 && b.paid <= 0) continue;
    items.push({
      key: `w:${w.id}`,
      kind: "LABOUR",
      name: w.name,
      sub: `${w.role} · ${b.daysPresent} day(s)${b.halfDays ? ` + ${b.halfDays} half` : ""}${b.balance < -0.5 ? ` · advance ${inr(-b.balance)}` : ""}`,
      total: b.earned,
      done: Math.min(b.paid, b.earned),
      remaining: b.balance,
      href: `/workers/${w.id}`,
      since: w.joinedAt.toISOString().slice(0, 10),
    });
  }

  const open = (i: Item) => i.remaining > 0.5;
  const sumDue = (k: Kind) => items.filter((i) => i.kind === k && open(i)).reduce((s, i) => s + i.remaining, 0);
  const shown = items
    .filter((i) => (!type || i.kind === type) && (showAll || open(i)))
    .sort((a, b) => Number(open(b)) - Number(open(a)) || b.remaining - a.remaining);
  const settledCount = items.filter((i) => (!type || i.kind === type) && !open(i)).length;

  // every part payment made / received, newest first
  const recent = ledger.filter((e) => e.kind === "MATERIAL" || e.kind === "CONTRACT" || e.kind === "RECEIVED").slice(0, 25);

  const href = (k?: Kind, all = showAll) => {
    const q = new URLSearchParams({ ...(k ? { type: k } : {}), ...(all ? { show: "all" } : {}) }).toString();
    return q ? `/dues?${q}` : "/dues";
  };

  return (
    <>
      <PageHeader title="Dues & Part Payments" subtitle="Everything that is partly paid – suppliers, contracts, labour wages and money to receive – in one place" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Due to suppliers" value={inr(sumDue("SUPPLIER"))} tone="red" />
        <Stat label="Due on contracts" value={inr(sumDue("CONTRACT"))} tone="red" />
        <Stat label="Labour wages due" value={inr(sumDue("LABOUR"))} tone="red" />
        <Stat label="Still to receive" value={inr(sumDue("RECEIVE"))} tone="green" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={href(undefined)} className={`rounded-full px-3 py-1 text-sm ${!type ? "bg-stone-900 text-white" : "bg-white ring-1 ring-stone-200 hover:bg-stone-50"}`}>
          All
        </Link>
        {KINDS.map((k) => (
          <Link key={k.kind} href={href(k.kind)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${type === k.kind ? "bg-stone-900 text-white" : "bg-white ring-1 ring-stone-200 hover:bg-stone-50"}`}>
            <span className={`h-2 w-2 rounded-full ${k.color}`} />
            {k.label}
          </Link>
        ))}
        {(settledCount > 0 || showAll) && (
          <Link href={href(type, !showAll)} className="ml-auto text-xs text-brand-700 hover:underline">
            {showAll ? "Hide fully paid" : `Show ${settledCount} fully paid`}
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={`${shown.length} ${showAll ? "item(s)" : "open item(s)"} – click one for full history and to record a payment`}>
          {shown.length === 0 ? (
            <Empty>Nothing pending here. 👍</Empty>
          ) : (
            <div className="space-y-3">
              {shown.map((i) => {
                const k = KINDS.find((x) => x.kind === i.kind)!;
                const receive = i.kind === "RECEIVE";
                return (
                  <Link key={i.key} href={i.href} className="block rounded-lg border border-stone-200 p-3 transition hover:border-brand-500 hover:shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-semibold">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${k.color}`} />
                          {i.name}
                          <span className="text-xs font-normal text-stone-500">{k.label}</span>
                        </div>
                        <div className="text-sm text-stone-500">{i.sub} · since {prettyDate(i.since)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-stone-500">
                          {inr(i.done)} of <b className="text-stone-900">{inr(i.total)}</b> {receive ? "received" : "paid"}
                        </div>
                        {open(i) ? (
                          <div className={`font-semibold tabular-nums ${receive ? "text-emerald-600" : "text-rose-600"}`}>{inr(i.remaining)} {receive ? "to receive" : "due"}</div>
                        ) : (
                          <Badge tone="PRESENT">{receive ? "Fully received" : "Fully paid"}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Bar value={i.done} max={i.total} color={k.color} />
                      <span className="w-12 text-right text-xs font-semibold tabular-nums">{i.total > 0 ? Math.round((i.done / i.total) * 100) : 100}%</span>
                    </div>
                    {i.alert && open(i) && (
                      <div className="mt-2">
                        <Badge tone={i.alert.includes("overdue") ? "DUE" : "HALF"}>{i.alert}</Badge>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Recent part payments">
          {recent.length === 0 ? (
            <Empty>No supplier or contract payments yet.</Empty>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {recent.map((e) => (
                <li key={e.key} className="py-2">
                  <div className="flex justify-between gap-2">
                    <Link href={e.href ?? "#"} className="min-w-0 truncate font-medium hover:underline">{e.what}</Link>
                    <b className={`shrink-0 tabular-nums ${e.kind === "RECEIVED" ? "text-emerald-600" : ""}`}>
                      {e.kind === "RECEIVED" ? "+ " : ""}{inr(e.amount)}
                    </b>
                  </div>
                  <div className="text-xs text-stone-500">
                    {prettyDate(e.date)} · {LEDGER_KINDS.find((k) => k.kind === e.kind)?.label} · {modeLabel(e.mode)}
                    {e.enteredBy && ` · entered by ${e.enteredBy}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
