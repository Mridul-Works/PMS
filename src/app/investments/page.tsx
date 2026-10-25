import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { addInvestment, deleteInvestment } from "@/lib/actions";
import { PAYMENT_MODES, modeLabel } from "@/lib/constants";
import { inr, prettyDate, today } from "@/lib/format";
import { Badge, Card, Empty, Field, PageHeader, Select, Stat } from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/buttons";
import { getTotals } from "@/lib/totals";

export default async function InvestmentsPage() {
  const site = (await getCurrentSite())!;
  const [list, totals] = await Promise.all([
    prisma.investment.findMany({ where: { siteId: site.id }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
    getTotals(site.id),
  ]);
  const bySource = new Map<string, number>();
  for (const i of list) bySource.set(i.source, (bySource.get(i.source) ?? 0) + i.amount);
  const balance = totals.fundsIn - totals.cashOut;

  return (
    <>
      <PageHeader title="Funds / Investment" subtitle="Money put into this project – by owner, partners, loans – and how much of it is left" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total funds put in" value={inr(totals.fundsIn)} tone="blue" />
        <Stat label="Total money spent" value={inr(totals.cashOut)} hint="labour paid + materials paid + expenses" />
        <Stat
          label={balance >= 0 ? "Funds remaining" : "Spent beyond funds"}
          value={inr(Math.abs(balance))}
          tone={balance >= 0 ? "green" : "red"}
        />
        <Stat label="Budget" value={inr(site.budget)} hint={site.budget ? `${Math.round((totals.totalCost / site.budget) * 100)}% used` : "set it on Sites page"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Funds received">
            {list.length === 0 ? (
              <Empty>No funds recorded yet. Add money you or partners put into the project.</Empty>
            ) : (
              <div className="-m-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>From</th>
                      <th>Mode</th>
                      <th>Note</th>
                      <th className="text-right">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => (
                      <tr key={i.id}>
                        <td className="whitespace-nowrap">{prettyDate(i.date)}</td>
                        <td className="font-medium">{i.source}</td>
                        <td><Badge tone={i.mode}>{modeLabel(i.mode)}</Badge></td>
                        <td className="text-stone-600">{i.note}</td>
                        <td className="text-right font-semibold tabular-nums">{inr(i.amount)}</td>
                        <td className="text-right">
                          <form action={deleteInvestment}>
                            <input type="hidden" name="id" value={i.id} />
                            <DeleteButton />
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {bySource.size > 0 && (
            <Card title="By source">
              <ul className="divide-y divide-stone-100 text-sm">
                {[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([s, a]) => (
                  <li key={s} className="flex justify-between py-2">
                    <span>{s}</span>
                    <b className="tabular-nums">{inr(a)}</b>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card title="Add funds">
          <form action={addInvestment} className="space-y-3">
            <Field label="From (person / bank / loan) *">
              <input name="source" required className="input" placeholder="e.g. Self, Partner – Amit, Home loan" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹) *">
                <input name="amount" type="number" min="1" step="any" required className="input" />
              </Field>
              <Field label="Date">
                <input name="date" type="date" defaultValue={today()} className="input" />
              </Field>
            </div>
            <Field label="Mode">
              <Select name="mode" options={PAYMENT_MODES} defaultValue="BANK" />
            </Field>
            <Field label="Note">
              <input name="note" className="input" />
            </Field>
            <SubmitButton>Add funds</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
