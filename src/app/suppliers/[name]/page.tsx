import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { deleteMaterialPayment, payMaterialDue, paySupplier } from "@/lib/actions";
import { modeLabel } from "@/lib/constants";
import { dealSummary } from "@/lib/calc";
import { inr, num, prettyDate, today } from "@/lib/format";
import { NO_SUPPLIER } from "@/lib/links";
import { getPartnerContext } from "@/lib/partners";
import { Badge, Bar, ByTag, Card, Empty, Field, PageHeader, Stat } from "@/components/ui";
import { ModeChoice, PaidByChoice } from "@/components/Choice";
import { DeleteButton, SubmitButton } from "@/components/buttons";
import { AmountField } from "@/components/AmountField";

export default async function SupplierPage({ params }: { params: Promise<{ name: string }> }) {
  const raw = decodeURIComponent((await params).name);
  const supplier = raw === NO_SUPPLIER ? null : raw;
  const site = (await getCurrentSite())!;
  const t = today();

  const [bills, deals, ctx] = await Promise.all([
    prisma.materialPurchase.findMany({
      where: { siteId: site.id, supplier: supplier ? { equals: supplier, mode: "insensitive" } : null },
      include: { payments: { include: { paidBy: true, createdBy: { select: { name: true } } }, orderBy: [{ date: "asc" }, { id: "asc" }] } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    supplier
      ? prisma.deal.findMany({ where: { siteId: site.id, party: { equals: supplier, mode: "insensitive" } }, include: { payments: true }, orderBy: { date: "desc" } })
      : Promise.resolve([]),
    getPartnerContext(site.id),
  ]);

  const title = supplier ?? "Purchases without a supplier";
  const billed = bills.reduce((s, b) => s + b.total, 0);
  const paid = bills.reduce((s, b) => s + b.paid, 0);
  const due = Math.max(0, billed - paid);
  const openBills = bills.filter((b) => b.total - b.paid > 0.5);

  // one timeline of every payment made to this supplier
  const timeline = bills
    .flatMap((b) => {
      const rows = b.payments.map((p) => ({ key: `p${p.id}`, date: p.date, amount: p.amount, mode: p.mode, by: p.paidBy?.name, entered: p.createdBy?.name, note: p.note, bill: b }));
      // old bills may have a "paid" amount without payment rows
      const legacy = b.paid - b.payments.reduce((s, p) => s + p.amount, 0);
      if (legacy > 0.5) rows.push({ key: `l${b.id}`, date: b.date, amount: legacy, mode: b.mode, by: undefined, entered: undefined, note: "At purchase", bill: b });
      return rows;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <>
      <PageHeader title={title} subtitle="Supplier – all bills, payments made and what is still due">
        <Link href="/dues" className="btn-ghost">← All dues</Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total billed" value={inr(billed)} hint={`${bills.length} bill(s)`} />
        <Stat label="Paid" value={inr(paid)} tone="green" hint={billed ? `${Math.round((paid / billed) * 100)}% of billed` : undefined} />
        <Stat label="Still due" value={inr(due)} tone={due > 0.5 ? "red" : "green"} hint={openBills.length ? `${openBills.length} bill(s) open` : "all settled"} />
        <Stat label="Last payment" value={timeline[0] ? inr(timeline[0].amount) : "–"} hint={timeline[0] ? prettyDate(timeline[0].date) : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Bills">
            {bills.length === 0 ? (
              <Empty>No purchases from this supplier on this site.</Empty>
            ) : (
              <div className="space-y-4">
                {bills.map((b) => {
                  const bDue = b.total - b.paid;
                  const legacy = b.paid - b.payments.reduce((s, p) => s + p.amount, 0);
                  return (
                    <div key={b.id} className={`rounded-lg border p-3 ${bDue > 0.5 ? "border-rose-200" : "border-stone-200"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">
                            {b.material}
                            {b.quantity > 0 && (
                              <>
                                {" "}· {num(b.quantity)} {b.unit} <span className="font-normal text-stone-500">@ {inr(b.rate)}</span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-stone-500">
                            {prettyDate(b.date)}
                            {b.billNo && ` · Bill ${b.billNo}`}
                            {b.note && ` · ${b.note}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-stone-500">
                            {inr(b.paid)} of <b className="text-stone-900">{inr(b.total)}</b>
                          </div>
                          {bDue > 0.5 ? <Badge tone="DUE">{inr(bDue)} due</Badge> : <Badge tone="PRESENT">Paid in full</Badge>}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Bar value={b.paid} max={b.total} color={bDue > 0.5 ? "bg-rose-500" : "bg-emerald-500"} />
                        <span className="w-12 text-right text-xs font-semibold tabular-nums">{Math.round((b.paid / (b.total || 1)) * 100)}%</span>
                      </div>

                      {/* payment history of this bill */}
                      {(b.payments.length > 0 || legacy > 0.5) && (
                        <ul className="mt-3 divide-y divide-stone-100 rounded-lg bg-stone-50 px-3 text-sm">
                          {legacy > 0.5 && (
                            <li className="flex items-center justify-between py-1.5 text-stone-600">
                              <span>{prettyDate(b.date)} · {modeLabel(b.mode)} · at purchase</span>
                              <b className="tabular-nums">{inr(legacy)}</b>
                            </li>
                          )}
                          {b.payments.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                              <span className="text-stone-600">
                                {prettyDate(p.date)} · {modeLabel(p.mode)}
                                <ByTag name={p.paidBy?.name} />
                                {p.note && <span className="ml-1 text-xs text-stone-500">· {p.note}</span>}
                                {p.createdBy && <span className="ml-1 text-[11px] text-stone-400">entered by {p.createdBy.name}</span>}
                              </span>
                              <span className="flex items-center gap-2">
                                <b className="tabular-nums">{inr(p.amount)}</b>
                                <form action={deleteMaterialPayment}>
                                  <input type="hidden" name="id" value={p.id} />
                                  <DeleteButton label="✕" confirmText="Remove this payment? The amount becomes due again." />
                                </form>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* pay this bill */}
                      {bDue > 0.5 && (
                        <details className="mt-3">
                          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-700 sm:min-h-0">Pay this bill</summary>
                          <form action={payMaterialDue} className="mt-2 grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
                            <input type="hidden" name="id" value={b.id} />
                            <div className="sm:col-span-2">
                              <AmountField key={b.payments.length} name="amount" label="Amount (₹ or % of bill)" total={b.total} remaining={bDue} required />
                            </div>
                            <div className="sm:col-span-2"><ModeChoice /></div>
                            <div className="sm:col-span-2"><PaidByChoice partners={ctx.partners} defaultId={ctx.defaultId} /></div>
                            <Field label="Date"><input name="date" type="date" defaultValue={t} className="input" /></Field>
                            <Field label="Note"><input name="note" className="input" /></Field>
                            <div className="sm:col-span-2"><SubmitButton>Save payment</SubmitButton></div>
                          </form>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {deals.length > 0 && (
            <Card title="Part-payment deals with this party">
              <div className="space-y-3">
                {deals.map((d) => {
                  const s = dealSummary(d, t);
                  return (
                    <Link key={d.id} href={`/deals/${d.id}`} className="block rounded-lg border border-stone-200 p-3 hover:border-brand-500">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium">{d.title} <span className="text-stone-500">· {d.direction === "PAY" ? "we pay" : "we receive"}</span></span>
                        <span>{inr(s.done)} of <b>{inr(d.totalAmount)}</b></span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Bar value={s.done} max={d.totalAmount} color={d.direction === "PAY" ? "bg-rose-500" : "bg-emerald-500"} />
                        <span className="w-24 text-right text-xs font-semibold tabular-nums">{s.complete ? "done" : `${inr(s.remaining)} left`}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {due > 0.5 && (
            <Card id="add" title="Pay supplier">
              <form action={paySupplier} className="space-y-3">
                <input type="hidden" name="supplier" value={supplier ?? NO_SUPPLIER} />
                <AmountField key={timeline.length} name="amount" label="Amount (₹)" total={due} remaining={due} quick={[]} required />
                <ModeChoice />
                <PaidByChoice partners={ctx.partners} defaultId={ctx.defaultId} />
                <Field label="Date"><input name="date" type="date" defaultValue={t} className="input" /></Field>
                <Field label="Note"><input name="note" className="input" /></Field>
                <SubmitButton>Save payment</SubmitButton>
              </form>
              <p className="mt-3 text-xs text-stone-500">The amount is adjusted against the oldest unpaid bills first. To pay one particular bill, use “Pay this bill” on it.</p>
            </Card>
          )}

          <Card title="Payment history">
            {timeline.length === 0 ? (
              <Empty>No payments yet.</Empty>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {timeline.map((p) => (
                  <li key={p.key} className="py-2">
                    <div className="flex justify-between gap-2">
                      <span>{prettyDate(p.date)} <Badge tone={p.mode}>{modeLabel(p.mode)}</Badge></span>
                      <b className="tabular-nums">{inr(p.amount)}</b>
                    </div>
                    <div className="text-xs text-stone-500">
                      {p.bill.material}{p.bill.billNo && ` · Bill ${p.bill.billNo}`}
                      {p.by && ` · by ${p.by}`}
                      {p.note && ` · ${p.note}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
