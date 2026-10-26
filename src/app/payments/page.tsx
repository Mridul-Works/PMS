import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { addLabourPayment, deleteLabourPayment } from "@/lib/actions";
import { LABOUR_PAYMENT_TYPES, PAYMENT_MODES, modeLabel, payTypeLabel } from "@/lib/constants";
import { inr, isMonth, prettyDate, thisMonth, today } from "@/lib/format";
import { Badge, ByTag, Card, Empty, Field, MonthNav, PageHeader, PaidBySelect, Select, Stat } from "@/components/ui";
import { getPartnerContext } from "@/lib/partners";
import { DeleteButton, SubmitButton } from "@/components/buttons";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; mode?: string; type?: string; by?: string }>;
}) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month! : thisMonth();
  const site = (await getCurrentSite())!;

  const byFilter = sp.by === "fund" ? null : sp.by ? Number(sp.by) : undefined;
  const [workers, payments, allTime, ctx] = await Promise.all([
    prisma.worker.findMany({ where: { siteId: site.id }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.labourPayment.findMany({
      where: {
        siteId: site.id,
        date: { startsWith: month },
        ...(sp.mode ? { mode: sp.mode } : {}),
        ...(sp.type ? { type: sp.type } : {}),
        ...(byFilter !== undefined ? { paidById: byFilter } : {}),
      },
      include: { worker: true, paidBy: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    prisma.labourPayment.aggregate({ where: { siteId: site.id }, _sum: { amount: true } }),
    getPartnerContext(site.id),
  ]);

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const byMode = (m: string) => payments.filter((p) => p.mode === m).reduce((s, p) => s + p.amount, 0);
  const advances = payments.filter((p) => p.type === "ADVANCE").reduce((s, p) => s + p.amount, 0);

  const filterLink = (key: "mode" | "type" | "by", value?: string) => {
    const q = new URLSearchParams({ month, ...(sp.mode ? { mode: sp.mode } : {}), ...(sp.type ? { type: sp.type } : {}), ...(sp.by ? { by: sp.by } : {}) });
    if (value) q.set(key, value);
    else q.delete(key);
    return `/payments?${q}`;
  };
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${active ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-50"}`;

  return (
    <>
      <PageHeader title="Labour Payments" subtitle="Daily wages, advances and settlements paid to workers">
        <MonthNav month={month} basePath="/payments" params={{ ...(sp.mode ? { mode: sp.mode } : {}), ...(sp.type ? { type: sp.type } : {}), ...(sp.by ? { by: sp.by } : {}) }} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Paid this month" value={inr(total)} hint={`${payments.length} payments`} />
        <Stat label="Cash" value={inr(byMode("CASH"))} tone="green" />
        <Stat label="Google Pay / UPI" value={inr(byMode("GPAY"))} tone="blue" />
        <Stat label="Bank transfer" value={inr(byMode("BANK"))} />
        <Stat label="Advances (month)" value={inr(advances)} tone="orange" hint={`All-time paid: ${inr(allTime._sum.amount ?? 0)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Payments">
          <div className="mb-4 flex flex-wrap gap-2">
            <Link href={filterLink("mode")} className={chip(!sp.mode)}>All modes</Link>
            {PAYMENT_MODES.map((m) => (
              <Link key={m.value} href={filterLink("mode", m.value)} className={chip(sp.mode === m.value)}>
                {m.label}
              </Link>
            ))}
            <span className="mx-1 border-l border-stone-200" />
            <Link href={filterLink("type")} className={chip(!sp.type)}>All types</Link>
            {LABOUR_PAYMENT_TYPES.map((m) => (
              <Link key={m.value} href={filterLink("type", m.value)} className={chip(sp.type === m.value)}>
                {m.label}
              </Link>
            ))}
            {ctx.partners.length > 0 && (
              <>
                <span className="mx-1 border-l border-stone-200" />
                <Link href={filterLink("by")} className={chip(!sp.by)}>Anyone</Link>
                {ctx.partners.map((p) => (
                  <Link key={p.id} href={filterLink("by", String(p.id))} className={chip(sp.by === String(p.id))}>
                    by {p.name}
                  </Link>
                ))}
                <Link href={filterLink("by", "fund")} className={chip(sp.by === "fund")}>Project fund</Link>
              </>
            )}
          </div>
          {payments.length === 0 ? (
            <Empty>No payments for this month.</Empty>
          ) : (
            <div className="-mx-4 -mb-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Worker</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th>Note</th>
                    <th className="text-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{prettyDate(p.date)}</td>
                      <td>
                        <Link href={`/workers/${p.workerId}`} className="font-medium hover:text-brand-700">
                          {p.worker.name}
                        </Link>
                      </td>
                      <td><Badge tone={p.type}>{payTypeLabel(p.type)}</Badge></td>
                      <td className="whitespace-nowrap">
                        <Badge tone={p.mode}>{modeLabel(p.mode)}</Badge>
                        <ByTag name={p.paidBy?.name} />
                      </td>
                      <td className="text-stone-600">{p.note}</td>
                      <td className="text-right font-semibold tabular-nums">{inr(p.amount)}</td>
                      <td className="text-right">
                        <form action={deleteLabourPayment}>
                          <input type="hidden" name="id" value={p.id} />
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

        <Card title="Add payment">
          {workers.length === 0 ? (
            <Empty>
              <Link href="/workers" className="text-brand-700 underline">Add a worker</Link> first.
            </Empty>
          ) : (
            <form action={addLabourPayment} className="space-y-3">
              <Field label="Worker *">
                <Select
                  name="workerId"
                  options={workers.map((w) => ({ value: String(w.id), label: `${w.name}${w.active ? "" : " (inactive)"}` }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₹) *">
                  <input name="amount" type="number" min="1" required className="input" />
                </Field>
                <Field label="Date">
                  <input name="date" type="date" defaultValue={today()} className="input" />
                </Field>
                <Field label="Type">
                  <Select name="type" options={LABOUR_PAYMENT_TYPES} />
                </Field>
                <Field label="Paid via">
                  <Select name="mode" options={PAYMENT_MODES} />
                </Field>
              </div>
              <PaidBySelect partners={ctx.partners} defaultId={ctx.defaultId} />
              <Field label="Note">
                <input name="note" className="input" placeholder="UPI ref, advance for 5 days…" />
              </Field>
              <SubmitButton>Save payment</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
