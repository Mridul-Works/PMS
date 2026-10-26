import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { addExpense, deleteExpense } from "@/lib/actions";
import { EXPENSE_CATEGORIES, PAYMENT_MODES, modeLabel } from "@/lib/constants";
import { inr, isMonth, prettyDate, thisMonth, today } from "@/lib/format";
import { Badge, Bar, ByTag, Card, Empty, Field, MonthNav, PageHeader, PaidBySelect, Select, Stat } from "@/components/ui";
import { getPartnerContext } from "@/lib/partners";
import { DeleteButton, SubmitButton } from "@/components/buttons";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month! : thisMonth();
  const site = (await getCurrentSite())!;
  const [list, allAgg, byCat, ctx] = await Promise.all([
    prisma.expense.findMany({ where: { siteId: site.id, date: { startsWith: month } }, include: { paidBy: true }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
    prisma.expense.aggregate({ where: { siteId: site.id }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["category"], where: { siteId: site.id }, _sum: { amount: true } }),
    getPartnerContext(site.id),
  ]);
  const monthTotal = list.reduce((s, e) => s + e.amount, 0);
  const cats = byCat.map((c) => ({ name: c.category, amount: c._sum.amount ?? 0 })).sort((a, b) => b.amount - a.amount);
  const max = cats[0]?.amount ?? 0;

  return (
    <>
      <PageHeader title="Other Expenses" subtitle="Transport, machinery, electricity, permits and other site costs">
        <MonthNav month={month} basePath="/expenses" />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="This month" value={inr(monthTotal)} hint={`${list.length} entries`} />
        <Stat label="All-time other expenses" value={inr(allAgg._sum.amount ?? 0)} />
        <Stat label="Top category" value={cats[0]?.name ?? "—"} hint={cats[0] ? inr(cats[0].amount) : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Expenses this month">
            {list.length === 0 ? (
              <Empty>No expenses for this month.</Empty>
            ) : (
              <div className="-m-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Paid to</th>
                      <th>Mode</th>
                      <th className="text-right">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={e.id}>
                        <td className="whitespace-nowrap">{prettyDate(e.date)}</td>
                        <td>{e.category}</td>
                        <td className="text-stone-600">{e.description}</td>
                        <td className="text-stone-600">{e.paidTo}</td>
                        <td className="whitespace-nowrap">
                          <Badge tone={e.mode}>{modeLabel(e.mode)}</Badge>
                          <ByTag name={e.paidBy?.name} />
                        </td>
                        <td className="text-right font-semibold tabular-nums">{inr(e.amount)}</td>
                        <td className="text-right">
                          <form action={deleteExpense}>
                            <input type="hidden" name="id" value={e.id} />
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

          <Card title="All-time by category">
            {cats.length === 0 ? (
              <Empty>No expenses yet.</Empty>
            ) : (
              <div className="space-y-3">
                {cats.map((c) => (
                  <div key={c.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{c.name}</span>
                      <b className="tabular-nums">{inr(c.amount)}</b>
                    </div>
                    <Bar value={c.amount} max={max} color="bg-violet-500" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="Add expense">
          <form action={addExpense} className="space-y-3">
            <Field label="Category">
              <Select name="category" options={EXPENSE_CATEGORIES} />
            </Field>
            <Field label="Description *">
              <input name="description" required className="input" placeholder="e.g. JCB 4 hours for foundation" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹) *">
                <input name="amount" type="number" min="1" step="any" required className="input" />
              </Field>
              <Field label="Date">
                <input name="date" type="date" defaultValue={today()} className="input" />
              </Field>
              <Field label="Paid via">
                <Select name="mode" options={PAYMENT_MODES} />
              </Field>
              <Field label="Paid to">
                <input name="paidTo" className="input" />
              </Field>
            </div>
            <PaidBySelect partners={ctx.partners} defaultId={ctx.defaultId} />
            <SubmitButton>Add expense</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
