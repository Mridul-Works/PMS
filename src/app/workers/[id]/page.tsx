import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { addLabourPayment, deleteLabourPayment, deleteWorker, saveWorker } from "@/lib/actions";
import { workerBalances } from "@/lib/calc";
import { LABOUR_PAYMENT_TYPES, PAYMENT_MODES, WORKER_ROLES, modeLabel, payTypeLabel } from "@/lib/constants";
import { daysInMonth, inr, isMonth, parseISODate, prettyDate, thisMonth, today } from "@/lib/format";
import { Badge, ByTag, Card, Empty, Field, MonthNav, PageHeader, PaidBySelect, Select, Stat } from "@/components/ui";
import { getPartnerContext } from "@/lib/partners";
import { DeleteButton, SubmitButton } from "@/components/buttons";

const STATUS_STYLE: Record<string, string> = {
  PRESENT: "bg-emerald-100 border-emerald-300",
  HALF: "bg-amber-100 border-amber-300",
  ABSENT: "bg-rose-100 border-rose-300",
};
const STATUS_TEXT: Record<string, string> = { PRESENT: "Present", HALF: "Half day", ABSENT: "Absent" };

export default async function WorkerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month! : thisMonth();
  const worker = await prisma.worker.findUnique({ where: { id: Number(id) } });
  if (!worker) notFound();

  const [attendance, payments, ctx] = await Promise.all([
    prisma.attendance.findMany({ where: { workerId: worker.id }, orderBy: { date: "asc" } }),
    prisma.labourPayment.findMany({ where: { workerId: worker.id }, include: { paidBy: true }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
    getPartnerContext(worker.siteId),
  ]);
  const all = workerBalances([worker], attendance, payments).get(worker.id)!;
  const monthAtt = attendance.filter((a) => a.date.startsWith(month));
  const monthPay = payments.filter((p) => p.date.startsWith(month));
  const mb = workerBalances([worker], monthAtt, monthPay).get(worker.id)!;
  const byDate = new Map(monthAtt.map((a) => [a.date, a]));
  const payByDate = new Map<string, number>();
  for (const p of monthPay) payByDate.set(p.date, (payByDate.get(p.date) ?? 0) + p.amount);

  const firstWeekday = parseISODate(`${month}-01`).getDay(); // 0 = Sunday
  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth(month); d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  const t = today();

  return (
    <>
      <PageHeader
        title={worker.name}
        subtitle={`${worker.role} · ${inr(worker.dailyWage)}/day${worker.phone ? ` · ${worker.phone}` : ""}`}
      >
        <Link href="/workers" className="btn-ghost">
          ← All workers
        </Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Total days worked"
          value={all.daysPresent + all.halfDays / 2}
          hint={`${all.daysPresent} full · ${all.halfDays} half`}
        />
        <Stat label="Total earned" value={inr(all.earned)} />
        <Stat label="Total paid" value={inr(all.paid)} tone="blue" />
        {all.balance >= 0 ? (
          <Stat label="Balance due to worker" value={inr(all.balance)} tone={all.balance > 0 ? "red" : "green"} />
        ) : (
          <Stat label="Advance outstanding" value={inr(-all.balance)} tone="orange" hint="adjusts against future wages" />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Attendance calendar"
          action={<MonthNav month={month} basePath={`/workers/${worker.id}`} />}
        >
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-stone-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const a = byDate.get(d);
              const paid = payByDate.get(d);
              return (
                <Link
                  key={d}
                  href={`/attendance?date=${d}`}
                  className={`min-h-16 rounded-lg border p-1.5 text-left text-xs transition hover:ring-2 hover:ring-brand-100 ${
                    a ? STATUS_STYLE[a.status] : "border-stone-200 bg-white"
                  } ${d === t ? "ring-2 ring-brand-500" : ""}`}
                >
                  <div className="font-semibold">{Number(d.slice(8))}</div>
                  {a && (
                    <div className="text-[10px] text-stone-600">
                      {STATUS_TEXT[a.status]}
                      {a.overtime ? ` +₹${a.overtime}` : ""}
                    </div>
                  )}
                  {paid && <div className="mt-0.5 text-[10px] font-semibold text-sky-700">paid ₹{paid}</div>}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-stone-600">
            <span>
              This month: <b>{mb.daysPresent}</b> present, <b>{mb.halfDays}</b> half day
            </span>
            <span>
              Earned <b>{inr(mb.earned)}</b>
            </span>
            <span>
              Paid <b>{inr(mb.paid)}</b>
            </span>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Pay this worker">
            <form action={addLabourPayment} className="space-y-3">
              <input type="hidden" name="workerId" value={worker.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₹) *">
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    required
                    className="input"
                    defaultValue={all.balance > 0 ? Math.round(all.balance) : undefined}
                  />
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
                <input name="note" className="input" placeholder="e.g. advance for 3 days" />
              </Field>
              <SubmitButton>Save payment</SubmitButton>
            </form>
          </Card>

          <Card title="Edit worker">
            <form action={saveWorker} className="space-y-3">
              <input type="hidden" name="id" value={worker.id} />
              <Field label="Name">
                <input name="name" defaultValue={worker.name} required className="input" />
              </Field>
              <Field label="Phone">
                <input name="phone" defaultValue={worker.phone ?? ""} className="input" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Role">
                  <Select name="role" options={WORKER_ROLES} defaultValue={worker.role} />
                </Field>
                <Field label="Daily wage (₹)">
                  <input name="dailyWage" type="number" min="0" defaultValue={worker.dailyWage} className="input" />
                </Field>
              </div>
              <Field label="Notes">
                <input name="notes" defaultValue={worker.notes ?? ""} className="input" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={worker.active} /> Active (currently working)
              </label>
              <p className="text-xs text-stone-500">Changing the wage also re-calculates past earnings.</p>
              <SubmitButton>Save</SubmitButton>
            </form>
            <form action={deleteWorker} className="mt-3 border-t border-stone-100 pt-3">
              <input type="hidden" name="id" value={worker.id} />
              <DeleteButton
                label="Delete worker and all their records"
                confirmText="This deletes the worker with ALL attendance and payments. If they just left, untick 'Active' instead. Continue?"
              />
            </form>
          </Card>
        </div>
      </div>

      <Card className="mt-6" title="Payment history">
        {payments.length === 0 ? (
          <Empty>No payments yet.</Empty>
        ) : (
          <div className="-m-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
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
                    <td>{prettyDate(p.date)}</td>
                    <td>
                      <Badge tone={p.type}>{payTypeLabel(p.type)}</Badge>
                    </td>
                    <td>
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
    </>
  );
}
