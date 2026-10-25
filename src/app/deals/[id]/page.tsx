import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { addDealPayment, completeDealPayment, deleteDeal, deleteDealPayment, updateDeal } from "@/lib/actions";
import { dealSummary } from "@/lib/calc";
import { DEAL_CATEGORIES_PAY, DEAL_CATEGORIES_RECEIVE, PAYMENT_MODES, modeLabel } from "@/lib/constants";
import { inr, prettyDate, today } from "@/lib/format";
import { Badge, Card, Empty, Field, PageHeader, Select, Stat } from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/buttons";
import { AmountField } from "@/components/AmountField";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id: Number(id) },
    include: { payments: { orderBy: [{ date: "asc" }, { id: "asc" }] } },
  });
  if (!deal) notFound();
  const t = today();
  const s = dealSummary(deal, t);
  const pay = deal.direction === "PAY";
  const verb = pay ? "Paid" : "Received";
  const done = deal.payments.filter((p) => p.status === "PAID");
  const planned = deal.payments.filter((p) => p.status === "PLANNED");
  const pctOf = (a: number) => (deal.totalAmount ? `${((a / deal.totalAmount) * 100).toFixed(1)}%` : "");

  return (
    <>
      <PageHeader title={deal.party} subtitle={`${pay ? "We pay" : "We receive"} · ${deal.title !== deal.party ? deal.title + " · " : ""}${deal.category}`}>
        <Link href={`/deals?dir=${deal.direction}`} className="btn-ghost">
          ← All part payments
        </Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total amount" value={inr(deal.totalAmount)} hint={`agreed on ${prettyDate(deal.date)}`} />
        <Stat label={`${verb} so far`} value={inr(s.done)} tone={pay ? "blue" : "green"} hint={`${s.pct.toFixed(1)}% of total · ${done.length} payment(s)`} />
        {s.remaining >= -0.5 ? (
          <Stat label={pay ? "Left to pay" : "Left to receive"} value={inr(Math.max(0, s.remaining))} tone={s.complete ? "green" : "red"} hint={s.complete ? "Completed ✓" : `${(100 - s.pct).toFixed(1)}% remaining`} />
        ) : (
          <Stat label={pay ? "Paid extra" : "Received extra"} value={inr(-s.remaining)} tone="orange" hint="more than the total" />
        )}
        <Stat
          label="Planned installments"
          value={inr(s.planned)}
          hint={s.overdue.length ? <span className="text-rose-600">{s.overdue.length} overdue</span> : s.nextDue ? `next on ${prettyDate(s.nextDue.date)}` : s.unplanned > 0.5 ? `${inr(s.unplanned)} has no date yet` : undefined}
        />
      </div>

      {/* progress strip: done | planned | unplanned */}
      <div className="card mb-6 p-4">
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-stone-100 text-[10px] font-semibold text-white">
          <div className={pay ? "bg-sky-500" : "bg-emerald-500"} style={{ width: `${Math.min(100, s.pct)}%` }} />
          <div className="bg-amber-400" style={{ width: `${Math.min(100 - Math.min(100, s.pct), (s.planned / Math.max(deal.totalAmount, 1)) * 100)}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-stone-600">
          <span className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${pay ? "bg-sky-500" : "bg-emerald-500"}`} /> {verb.toLowerCase()} {inr(s.done)}</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> planned {inr(s.planned)}</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-stone-200" /> not planned {inr(s.unplanned)}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`${verb} installments`}>
            {done.length === 0 ? (
              <Empty>Nothing {verb.toLowerCase()} yet.</Empty>
            ) : (
              <div className="-m-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Mode</th>
                      <th>Note</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">% of total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {done.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{prettyDate(p.date)}</td>
                        <td><Badge tone={p.mode}>{modeLabel(p.mode)}</Badge></td>
                        <td className="text-stone-600">{p.note}</td>
                        <td className="text-right font-semibold tabular-nums">{inr(p.amount)}</td>
                        <td className="text-right tabular-nums text-stone-500">{pctOf(p.amount)}</td>
                        <td className="text-right">
                          <form action={deleteDealPayment}>
                            <input type="hidden" name="id" value={p.id} />
                            <DeleteButton />
                          </form>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-stone-50 font-semibold">
                      <td colSpan={3}>Total {verb.toLowerCase()}</td>
                      <td className="text-right tabular-nums">{inr(s.done)}</td>
                      <td className="text-right tabular-nums">{s.pct.toFixed(1)}%</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Planned / upcoming installments">
            {planned.length === 0 ? (
              <Empty>No planned installments. Use the form to plan a future {pay ? "payment" : "receipt"} with a due date.</Empty>
            ) : (
              <ul className="divide-y divide-stone-100">
                {planned.map((p) => {
                  const overdue = p.date < t;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <b className="tabular-nums">{inr(p.amount)}</b>
                          <span className="text-xs text-stone-500">{pctOf(p.amount)}</span>
                          {overdue ? <Badge tone="DUE">overdue</Badge> : p.date === t ? <Badge tone="HALF">due today</Badge> : null}
                        </div>
                        <div className="text-xs text-stone-500">
                          Due {prettyDate(p.date)}
                          {p.note ? ` · ${p.note}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <form action={completeDealPayment} className="flex flex-wrap items-center gap-1">
                          <input type="hidden" name="id" value={p.id} />
                          <input name="amount" type="number" min="1" step="any" defaultValue={p.amount} className="w-24 rounded border border-stone-300 px-2 py-1 text-xs" title="Amount actually paid" />
                          <input name="date" type="date" defaultValue={t} className="rounded border border-stone-300 px-1 py-1 text-xs" />
                          <select name="mode" defaultValue={p.mode} className="rounded border border-stone-300 px-1 py-1 text-xs">
                            {PAYMENT_MODES.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                          <SubmitButton className="rounded bg-stone-800 px-2 py-1 text-xs font-medium text-white">Mark {verb.toLowerCase()}</SubmitButton>
                        </form>
                        <form action={deleteDealPayment}>
                          <input type="hidden" name="id" value={p.id} />
                          <DeleteButton label="✕" confirmText="Remove this planned installment?" />
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={pay ? "Add payment" : "Add receipt"}>
            <form action={addDealPayment} className="space-y-3">
              <input type="hidden" name="dealId" value={deal.id} />
              <AmountField key={deal.payments.length} name="amount" label="Amount or % of total *" total={deal.totalAmount} remaining={Math.max(0, s.remaining)} required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <Select
                    name="status"
                    options={[
                      { value: "PAID", label: pay ? "Paid now" : "Received now" },
                      { value: "PLANNED", label: "Planned (due date)" },
                    ]}
                  />
                </Field>
                <Field label="Date / due date">
                  <input name="date" type="date" defaultValue={t} className="input" />
                </Field>
              </div>
              <Field label="Mode">
                <Select name="mode" options={PAYMENT_MODES} />
              </Field>
              <Field label="Note">
                <input name="note" className="input" placeholder="e.g. after slab casting" />
              </Field>
              <SubmitButton>Save</SubmitButton>
            </form>
          </Card>

          <Card title="Edit deal">
            <form action={updateDeal} className="space-y-3">
              <input type="hidden" name="id" value={deal.id} />
              <Field label={pay ? "Paying to" : "Receiving from"}>
                <input name="party" defaultValue={deal.party} required className="input" />
              </Field>
              <Field label="For what">
                <input name="title" defaultValue={deal.title} className="input" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <Select name="category" options={pay ? DEAL_CATEGORIES_PAY : DEAL_CATEGORIES_RECEIVE} defaultValue={deal.category} />
                </Field>
                <Field label="Total (₹)">
                  <input name="totalAmount" type="number" min="1" step="any" defaultValue={deal.totalAmount} className="input" />
                </Field>
              </div>
              <Field label="Agreement date">
                <input name="date" type="date" defaultValue={deal.date} className="input" />
              </Field>
              <Field label="Note">
                <input name="note" defaultValue={deal.note ?? ""} className="input" />
              </Field>
              <SubmitButton>Save changes</SubmitButton>
            </form>
            <form action={deleteDeal} className="mt-3 border-t border-stone-100 pt-3">
              <input type="hidden" name="id" value={deal.id} />
              <DeleteButton label="Delete this deal and its installments" confirmText="Delete this deal and all its payments?" />
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
