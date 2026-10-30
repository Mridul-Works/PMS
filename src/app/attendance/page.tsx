import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { deleteLabourPayment } from "@/lib/actions";
import { dayEarning, workerBalances } from "@/lib/calc";
import { modeLabel, payTypeLabel } from "@/lib/constants";
import { inr, isDate, prettyDate, shiftDay, today } from "@/lib/format";
import { Badge, ByTag, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { getPartnerContext } from "@/lib/partners";
import { DeleteButton } from "@/components/buttons";
import { DateNav } from "@/components/DateNav";
import { PayWorker } from "@/components/PayWorker";
import { AttendanceSheet } from "@/components/AttendanceSheet";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = isDate(sp.date) ? sp.date! : today();
  const site = (await getCurrentSite())!;

  const [workers, records, payments, ctx, allAtt, allPay] = await Promise.all([
    prisma.worker.findMany({ where: { siteId: site.id }, orderBy: { name: "asc" } }),
    prisma.attendance.findMany({ where: { siteId: site.id, date } }),
    prisma.labourPayment.findMany({ where: { siteId: site.id, date }, include: { worker: true, paidBy: true }, orderBy: { id: "desc" } }),
    getPartnerContext(site.id),
    prisma.attendance.findMany({ where: { siteId: site.id }, select: { workerId: true, status: true, overtime: true } }),
    prisma.labourPayment.findMany({ where: { siteId: site.id }, select: { workerId: true, amount: true } }),
  ]);
  const bal = workerBalances(workers, allAtt, allPay);
  const recMap = new Map(records.map((r) => [r.workerId, r]));
  // show active workers + anyone who already has a record on this date
  const rows = workers
    .filter((w) => w.active || recMap.has(w.id))
    .map((w) => ({ ...w, status: recMap.get(w.id)?.status, overtime: recMap.get(w.id)?.overtime }));

  const wageOf = new Map(workers.map((w) => [w.id, w.dailyWage]));
  const present = records.filter((r) => r.status === "PRESENT").length;
  const half = records.filter((r) => r.status === "HALF").length;
  const wagesEarned = records.reduce((s, r) => s + dayEarning(r.status, wageOf.get(r.workerId) ?? 0, r.overtime), 0);
  const paidToday = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader title="Attendance" subtitle={prettyDate(date)}>
        <Link href={`/attendance?date=${shiftDay(date, -1)}`} className="btn-ghost">
          ‹ Prev
        </Link>
        <DateNav date={date} />
        <Link href={`/attendance?date=${shiftDay(date, 1)}`} className="btn-ghost">
          Next ›
        </Link>
        {date !== today() && (
          <Link href="/attendance" className="btn-ghost">
            Today
          </Link>
        )}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Present" value={present} hint={half ? `+ ${half} half day` : undefined} tone="green" />
        <Stat label="Absent" value={records.filter((r) => r.status === "ABSENT").length} tone="red" />
        <Stat label="Wages earned today" value={inr(wagesEarned)} />
        <Stat label="Paid today" value={inr(paidToday)} tone="blue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Mark attendance">
          {rows.length === 0 ? (
            <Empty>
              No active workers. <Link href="/workers" className="text-brand-700 underline">Add workers</Link> first.
            </Empty>
          ) : (
            <AttendanceSheet date={date} rows={rows} fresh={records.length === 0} />
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Pay a worker (this day)" id="add">
            {workers.length === 0 ? (
              <Empty>No workers yet.</Empty>
            ) : (
              <PayWorker
                workers={rows.map((w) => ({ id: w.id, name: w.name, role: w.role, dailyWage: w.dailyWage, due: bal.get(w.id)?.balance ?? 0 }))}
                partners={ctx.partners}
                defaultPartnerId={ctx.defaultId}
                date={date}
                today={today()}
              />
            )}
          </Card>

          <Card title="Payments on this day">
            {payments.length === 0 ? (
              <p className="text-sm text-stone-500">None.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <div className="font-medium">{p.worker.name}</div>
                      <div className="mt-0.5 flex gap-1">
                        <Badge tone={p.type}>{payTypeLabel(p.type)}</Badge>
                        <Badge tone={p.mode}>{modeLabel(p.mode)}</Badge>
                        <ByTag name={p.paidBy?.name} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold tabular-nums">{inr(p.amount)}</span>
                      <form action={deleteLabourPayment}>
                        <input type="hidden" name="id" value={p.id} />
                        <DeleteButton label="✕" />
                      </form>
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
