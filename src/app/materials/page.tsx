import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { deleteMaterial, deleteMaterialPayment, payMaterialDue } from "@/lib/actions";
import { modeLabel } from "@/lib/constants";
import { inr, num, prettyDate, today } from "@/lib/format";
import { Badge, Bar, ByTag, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { getPartnerContext } from "@/lib/partners";
import { supplierHref } from "@/lib/links";
import { DeleteButton } from "@/components/buttons";
import { MaterialForm } from "@/components/MaterialForm";
import { AmountField } from "@/components/AmountField";
import { ModeChoice, PaidByChoice } from "@/components/Choice";

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ material?: string }> }) {
  const sp = await searchParams;
  const site = (await getCurrentSite())!;
  const ctx = await getPartnerContext(site.id);
  const all = await prisma.materialPurchase.findMany({
    where: { siteId: site.id },
    include: { payments: { include: { paidBy: true }, orderBy: [{ date: "asc" }, { id: "asc" }] } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  const list = sp.material ? all.filter((m) => m.material === sp.material) : all;

  const total = all.reduce((s, m) => s + m.total, 0);
  const paid = all.reduce((s, m) => s + m.paid, 0);

  // summary per material
  const summary = new Map<string, { qty: Map<string, number>; amount: number; count: number }>();
  for (const m of all) {
    const s = summary.get(m.material) ?? { qty: new Map(), amount: 0, count: 0 };
    s.qty.set(m.unit, (s.qty.get(m.unit) ?? 0) + m.quantity);
    s.amount += m.total;
    s.count++;
    summary.set(m.material, s);
  }
  const summaryRows = [...summary.entries()].sort((a, b) => b[1].amount - a[1].amount);
  const maxAmt = summaryRows[0]?.[1].amount ?? 0;

  // supplier dues
  const dues = new Map<string, number>();
  for (const m of all) if (m.total - m.paid > 0.5) dues.set(m.supplier || "Unknown", (dues.get(m.supplier || "Unknown") ?? 0) + m.total - m.paid);
  const suppliers = [...new Set(all.map((m) => m.supplier).filter(Boolean) as string[])];

  return (
    <>
      <PageHeader title="Raw Materials" subtitle="Sariya, cement, bricks, sand and everything bought for the site" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total material cost" value={inr(total)} hint={`${all.length} purchases`} />
        <Stat label="Paid to suppliers" value={inr(paid)} tone="green" />
        <Stat label="Pending to suppliers" value={inr(total - paid)} tone="red" />
        <Stat label="Materials used" value={summary.size} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Summary by material">
            {summaryRows.length === 0 ? (
              <Empty>No purchases yet.</Empty>
            ) : (
              <div className="space-y-3">
                {summaryRows.map(([name, s]) => (
                  <Link key={name} href={sp.material === name ? "/materials" : `/materials?material=${encodeURIComponent(name)}`} className={`block rounded-lg p-2 hover:bg-stone-50 ${sp.material === name ? "bg-brand-50" : ""}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="tabular-nums">
                        <span className="mr-3 text-stone-500">
                          {[...s.qty.entries()].map(([u, q]) => `${num(q)} ${u}`).join(" + ")}
                        </span>
                        <b>{inr(s.amount)}</b>
                      </span>
                    </div>
                    <Bar value={s.amount} max={maxAmt} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title={sp.material ? `Purchases – ${sp.material}` : "All purchases"} action={sp.material && <Link href="/materials" className="text-xs text-brand-700 hover:underline">Show all</Link>}>
            {list.length === 0 ? (
              <Empty>Nothing here yet.</Empty>
            ) : (
              <div className="-m-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Material</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Total</th>
                      <th>Supplier</th>
                      <th>Payment</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => {
                      const due = m.total - m.paid;
                      return (
                        <tr key={m.id}>
                          <td className="whitespace-nowrap">{prettyDate(m.date)}</td>
                          <td>
                            <div className="whitespace-nowrap font-medium">{m.material}</div>
                            {(m.billNo || m.note) && <div className="text-xs text-stone-500">{[m.billNo && `Bill ${m.billNo}`, m.note].filter(Boolean).join(" · ")}</div>}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">{m.quantity > 0 ? `${num(m.quantity)} ${m.unit}` : "–"}</td>
                          <td className="text-right tabular-nums">{m.rate > 0 ? inr(m.rate) : "–"}</td>
                          <td className="text-right font-semibold tabular-nums">{inr(m.total)}</td>
                          <td className="text-stone-600">
                            <Link href={supplierHref(m.supplier)} className="hover:text-brand-700 hover:underline">{m.supplier || "—"}</Link>
                          </td>
                          <td className="min-w-52">
                            <div className="flex items-center gap-1.5 text-xs">
                              {due > 0.5 ? <Badge tone="DUE">{inr(due)} due</Badge> : <Badge tone="PRESENT">Paid in full</Badge>}
                              <span className="text-stone-500">{Math.round((m.paid / (m.total || 1)) * 100)}% paid</span>
                            </div>
                            <details className="mt-1 text-xs">
                              <summary className="flex min-h-11 cursor-pointer items-center text-brand-700 sm:min-h-0">
                                {due > 0.5 ? "Pay / history" : "History"} ({m.payments.length + (m.paid - m.payments.reduce((a, p) => a + p.amount, 0) > 0.5 ? 1 : 0)})
                              </summary>
                              <ul className="mt-1 space-y-0.5">
                                {m.paid - m.payments.reduce((a, p) => a + p.amount, 0) > 0.5 && (
                                  <li className="text-stone-600">{prettyDate(m.date)} · {inr(m.paid - m.payments.reduce((a, p) => a + p.amount, 0))} · {modeLabel(m.mode)}</li>
                                )}
                                {m.payments.map((p) => (
                                  <li key={p.id} className="flex items-center justify-between gap-2 text-stone-600">
                                    <span>{prettyDate(p.date)} · <b>{inr(p.amount)}</b> · {modeLabel(p.mode)}<ByTag name={p.paidBy?.name} /></span>
                                    <form action={deleteMaterialPayment}>
                                      <input type="hidden" name="id" value={p.id} />
                                      <DeleteButton label="✕" confirmText="Remove this payment? The amount becomes due again." />
                                    </form>
                                  </li>
                                ))}
                              </ul>
                              {due > 0.5 && (
                                <form action={payMaterialDue} className="mt-2 space-y-2 rounded-lg bg-stone-50 p-2">
                                  <input type="hidden" name="id" value={m.id} />
                                  <AmountField key={m.payments.length} name="amount" label="Pay now (₹ or % of bill)" total={m.total} remaining={due} required />
                                  <ModeChoice />
                                  <PaidByChoice partners={ctx.partners} defaultId={ctx.defaultId} />
                                  <div className="flex gap-2">
                                    <input name="date" type="date" defaultValue={today()} className="input min-h-11 w-auto sm:min-h-0" aria-label="Date" />
                                    <button className="btn-primary min-h-11 flex-1 sm:min-h-0">Pay</button>
                                  </div>
                                </form>
                              )}
                            </details>
                          </td>
                          <td className="text-right">
                            <form action={deleteMaterial}>
                              <input type="hidden" name="id" value={m.id} />
                              <DeleteButton />
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card id="add" title="Add purchase">
            <MaterialForm today={today()} suppliers={suppliers} partners={ctx.partners} defaultPartnerId={ctx.defaultId} />
          </Card>
          {dues.size > 0 && (
            <Card title="Supplier dues" action={<Link href="/dues?type=SUPPLIER" className="text-xs text-brand-700 hover:underline">All dues →</Link>}>
              <ul className="divide-y divide-stone-100 text-sm">
                {[...dues.entries()].sort((a, b) => b[1] - a[1]).map(([s, d]) => (
                  <li key={s}>
                    <Link href={supplierHref(s === "Unknown" ? null : s)} className="-mx-2 flex justify-between rounded px-2 py-2 hover:bg-stone-50">
                      <span className="text-brand-700 hover:underline">{s} →</span>
                      <b className="tabular-nums text-rose-600">{inr(d)}</b>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-stone-500">Click a supplier to see all their bills, payment history and to record a payment.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
