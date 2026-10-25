import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { deleteMaterial, payMaterialDue } from "@/lib/actions";
import { modeLabel } from "@/lib/constants";
import { inr, num, prettyDate, today } from "@/lib/format";
import { Badge, Bar, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { DeleteButton } from "@/components/buttons";
import { MaterialForm } from "@/components/MaterialForm";

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ material?: string }> }) {
  const sp = await searchParams;
  const site = (await getCurrentSite())!;
  const all = await prisma.materialPurchase.findMany({ where: { siteId: site.id }, orderBy: [{ date: "desc" }, { id: "desc" }] });
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
                            <div className="font-medium">{m.material}</div>
                            {(m.billNo || m.note) && <div className="text-xs text-stone-500">{[m.billNo && `Bill ${m.billNo}`, m.note].filter(Boolean).join(" · ")}</div>}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">{num(m.quantity)} {m.unit}</td>
                          <td className="text-right tabular-nums">{inr(m.rate)}</td>
                          <td className="text-right font-semibold tabular-nums">{inr(m.total)}</td>
                          <td className="text-stone-600">{m.supplier}</td>
                          <td>
                            <Badge tone={m.mode}>{modeLabel(m.mode)}</Badge>
                            {due > 0.5 && (
                              <form action={payMaterialDue} className="mt-1 flex items-center gap-1">
                                <input type="hidden" name="id" value={m.id} />
                                <Badge tone="DUE">{inr(due)} due</Badge>
                                <input name="amount" type="number" min="1" max={Math.ceil(due)} defaultValue={Math.round(due)} className="w-20 rounded border border-stone-300 px-1 py-0.5 text-xs" />
                                <button className="rounded bg-stone-800 px-2 py-0.5 text-xs text-white">Pay</button>
                              </form>
                            )}
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
          <Card title="Add purchase">
            <MaterialForm today={today()} suppliers={suppliers} />
          </Card>
          {dues.size > 0 && (
            <Card title="Supplier dues">
              <ul className="divide-y divide-stone-100 text-sm">
                {[...dues.entries()].sort((a, b) => b[1] - a[1]).map(([s, d]) => (
                  <li key={s} className="flex justify-between py-2">
                    <span>{s}</span>
                    <b className="tabular-nums text-rose-600">{inr(d)}</b>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
