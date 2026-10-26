import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { getTotals } from "@/lib/totals";
import { getPartnerReport } from "@/lib/partners";
import { modeLabel } from "@/lib/constants";
import { inr, inrShort, parseISODate, prettyDate, shiftMonth, thisMonth, today } from "@/lib/format";
import { Badge, ByTag, Card, Empty, PageHeader, Stat } from "@/components/ui";

const COLORS = { labour: "bg-brand-500", material: "bg-sky-500", contract: "bg-teal-500", other: "bg-violet-500" };

export default async function Dashboard() {
  const site = (await getCurrentSite())!;
  const t = today();
  const [totals, todayAtt, activeWorkers, recentPay, recentMat, recentExp, upcoming, recentDeal, partners] = await Promise.all([
    getTotals(site.id),
    prisma.attendance.findMany({ where: { siteId: site.id, date: t } }),
    prisma.worker.count({ where: { siteId: site.id, active: true } }),
    prisma.labourPayment.findMany({ where: { siteId: site.id }, include: { worker: true, paidBy: true }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 8 }),
    prisma.materialPurchase.findMany({ where: { siteId: site.id }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 8 }),
    prisma.expense.findMany({ where: { siteId: site.id }, include: { paidBy: true }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 8 }),
    prisma.dealPayment.findMany({ where: { siteId: site.id, status: "PLANNED" }, include: { deal: true }, orderBy: { date: "asc" }, take: 6 }),
    prisma.dealPayment.findMany({ where: { siteId: site.id, status: "PAID" }, include: { deal: true, paidBy: true }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 8 }),
    getPartnerReport(site.id),
  ]);

  const budget = site.budget;
  const usedPct = budget > 0 ? (totals.totalCost / budget) * 100 : 0;
  const pendingDues = totals.labourDue + totals.materialDue + totals.contractDue;
  const fundsLeft = totals.fundBalance;

  const parts = [
    { key: "labour" as const, label: "Labour", value: totals.labourPaid },
    { key: "material" as const, label: "Materials", value: totals.materialCost },
    { key: "contract" as const, label: "Contracts", value: totals.contractPaid },
    { key: "other" as const, label: "Other expenses", value: totals.expenseTotal },
  ];

  // last 6 months
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth(), i - 5));
  const monthRows = months.map((m) => {
    const r = totals.monthly.get(m) ?? { labour: 0, material: 0, contract: 0, other: 0 };
    return { m, ...r, total: r.labour + r.material + r.contract + r.other };
  });
  const maxMonth = Math.max(1, ...monthRows.map((r) => r.total));

  const recent = [
    ...recentPay.map((p) => ({ id: `p${p.id}`, date: p.date, what: `${p.worker.name} – ${p.type === "ADVANCE" ? "advance" : "wages"}`, kind: "Labour", amount: p.amount, mode: p.mode, by: p.paidBy?.name })),
    ...recentMat.map((m) => ({ id: `m${m.id}`, date: m.date, what: `${m.material} (${m.quantity} ${m.unit})`, kind: "Material", amount: m.total, mode: m.mode, by: undefined as string | undefined })),
    ...recentDeal.map((d) => ({
      id: `d${d.id}`,
      date: d.date,
      what: `${d.deal.direction === "PAY" ? "Paid to" : "Received from"} ${d.deal.party}${d.note ? ` – ${d.note}` : ""}`,
      kind: d.deal.direction === "PAY" ? "Part payment" : "Received",
      amount: d.amount,
      mode: d.mode,
      by: d.paidBy?.name,
    })),
    ...recentExp.map((e) => ({ id: `e${e.id}`, date: e.date, what: e.description, kind: "Expense", amount: e.amount, mode: e.mode, by: e.paidBy?.name })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 10);

  const present = todayAtt.filter((a) => a.status === "PRESENT").length;
  const half = todayAtt.filter((a) => a.status === "HALF").length;

  return (
    <>
      <PageHeader title={site.name} subtitle={[site.location, `Started ${prettyDate(site.startDate.toISOString().slice(0, 10))}`].filter(Boolean).join(" · ")}>
        <Link href="/attendance" className="btn-primary">Mark today&apos;s attendance</Link>
      </PageHeader>

      {/* Budget */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Total invested in construction so far</div>
            <div className="mt-1 text-4xl font-bold tabular-nums">{inr(totals.totalCost)}</div>
            <div className="mt-1 text-sm text-stone-500">
              {budget > 0 ? (
                <>
                  of {inr(budget)} budget · <b className={usedPct > 100 ? "text-rose-600" : "text-stone-800"}>{usedPct.toFixed(1)}% used</b> ·{" "}
                  {budget - totals.totalCost >= 0 ? `${inr(budget - totals.totalCost)} left` : `${inr(totals.totalCost - budget)} over budget`}
                </>
              ) : (
                <Link href="/sites" className="text-brand-700 underline">Set a budget for this site</Link>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {parts.map((p) => (
              <div key={p.key} className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-sm ${COLORS[p.key]}`} />
                <span className="text-stone-600">{p.label}</span>
                <b className="tabular-nums">{inr(p.value)}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-stone-100">
          {parts.map((p) => (
            <div
              key={p.key}
              className={COLORS[p.key]}
              style={{ width: `${(p.value / Math.max(budget, totals.totalCost, 1)) * 100}%` }}
              title={`${p.label}: ${inr(p.value)}`}
            />
          ))}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending dues" value={inr(pendingDues)} tone="red" hint={`Labour ${inr(totals.labourDue)} · Suppliers ${inr(totals.materialDue)} · Contracts ${inr(totals.contractDue)}`} />
        <Stat label="Advance with workers" value={inr(totals.labourAdvance)} tone="orange" hint="paid ahead of work" />
        <Stat
          label="Funds put in + received"
          value={inr(totals.fundsIn + totals.received)}
          tone="blue"
          hint={
            <>
              Funds {inrShort(totals.fundsIn)} · Received {inrShort(totals.received)}
              {totals.receivable > 0 && <> · <span className="text-emerald-700">{inrShort(totals.receivable)} still to come</span></>}
            </>
          }
        />
        <Stat
          label={fundsLeft >= 0 ? "Project fund in hand" : "Fund overspent"}
          value={inr(Math.abs(fundsLeft))}
          tone={fundsLeft >= 0 ? "green" : "red"}
          hint={`Spent from fund: ${inr(totals.fundOut)} · total spent ${inr(totals.cashOut)}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Monthly spending (last 6 months)">
          <div className="flex h-56 items-end gap-3">
            {monthRows.map((r) => (
              <div key={r.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="text-[11px] font-medium tabular-nums text-stone-600">{r.total ? inrShort(r.total) : ""}</div>
                <div className="flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${(r.total / maxMonth) * 85}%` }} title={`${inr(r.total)}`}>
                  {(["labour", "material", "contract", "other"] as const).map((k) =>
                    r[k] > 0 ? <div key={k} className={COLORS[k]} style={{ height: `${(r[k] / r.total) * 100}%` }} /> : null,
                  )}
                </div>
                <div className="text-xs text-stone-500">{parseISODate(`${r.m}-01`).toLocaleDateString("en-IN", { month: "short" })}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Today at site" action={<Link href="/calendar" className="text-xs text-brand-700 hover:underline">Calendar →</Link>}>
            <div className="text-3xl font-bold tabular-nums">
              {present}
              <span className="text-base font-normal text-stone-500"> / {activeWorkers} present</span>
            </div>
            {half > 0 && <div className="text-sm text-amber-600">+ {half} half day</div>}
            {todayAtt.length === 0 && activeWorkers > 0 && <div className="mt-1 text-sm text-rose-600">Attendance not marked yet</div>}
          </Card>

          <Card title="Upcoming installments" action={<Link href="/deals" className="text-xs text-brand-700 hover:underline">Part payments →</Link>}>
            {upcoming.length === 0 ? (
              <p className="text-sm text-stone-500">No planned installments.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {upcoming.map((u) => (
                  <li key={u.id}>
                    <Link href={`/deals/${u.dealId}`} className="flex items-center justify-between gap-2 py-2 hover:text-brand-700">
                      <div>
                        <div className="font-medium">
                          {u.deal.direction === "PAY" ? "↑ Pay " : "↓ Receive "}
                          {u.deal.party}
                        </div>
                        <div className={`text-xs ${u.date < t ? "font-semibold text-rose-600" : "text-stone-500"}`}>
                          {u.date < t ? "Overdue · " : u.date === t ? "Today · " : ""}
                          {prettyDate(u.date)}
                        </div>
                      </div>
                      <b className={`tabular-nums ${u.deal.direction === "PAY" ? "text-rose-600" : "text-emerald-600"}`}>{inr(u.amount)}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {partners.rows.length > 0 && (
            <Card title="Partners" action={<Link href="/investments" className="text-xs text-brand-700 hover:underline">Details →</Link>}>
              <div className="space-y-2 text-sm">
                {partners.rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span>
                      {r.name}
                      <span className="ml-1 text-xs text-stone-500">
                        {partners.totalNet ? `${((r.net / partners.totalNet) * 100).toFixed(0)}%` : ""}
                      </span>
                    </span>
                    <b className="tabular-nums">{inr(r.net)}</b>
                  </div>
                ))}
              </div>
              {partners.settlements.map((s, i) => (
                <p key={i} className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  {s.from} owes {s.to} {inr(s.amount)} to match shares
                </p>
              ))}
            </Card>
          )}

          <Card title="Paid by mode">
            <div className="space-y-2 text-sm">
              {Object.entries(totals.byMode).map(([m, v]) => (
                <div key={m} className="flex items-center justify-between">
                  <Badge tone={m}>{modeLabel(m)}</Badge>
                  <b className="tabular-nums">{inr(v)}</b>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6" title="Recent activity">
        {recent.length === 0 ? (
          <Empty>Nothing recorded yet. Start by adding workers, materials or expenses.</Empty>
        ) : (
          <div className="-m-4 overflow-x-auto">
            <table className="table">
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-stone-500">{prettyDate(r.date)}</td>
                    <td><Badge>{r.kind}</Badge></td>
                    <td>{r.what}</td>
                    <td className="whitespace-nowrap">
                      <Badge tone={r.mode}>{modeLabel(r.mode)}</Badge>
                      <ByTag name={r.by} />
                    </td>
                    <td className="text-right font-semibold tabular-nums">{inr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
