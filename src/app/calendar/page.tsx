import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { daysInMonth, inr, inrShort, isMonth, parseISODate, thisMonth, today } from "@/lib/format";
import { Card, MonthNav, PageHeader, Stat } from "@/components/ui";

type Day = { present: number; half: number; absent: number; labour: number; material: number; other: number };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month! : thisMonth();
  const site = (await getCurrentSite())!;
  const where = { siteId: site.id, date: { startsWith: month } };

  const [att, pays, mats, exps, activeWorkers] = await Promise.all([
    prisma.attendance.findMany({ where, select: { date: true, status: true } }),
    prisma.labourPayment.findMany({ where, select: { date: true, amount: true } }),
    prisma.materialPurchase.findMany({ where, select: { date: true, total: true } }),
    prisma.expense.findMany({ where, select: { date: true, amount: true } }),
    prisma.worker.count({ where: { siteId: site.id, active: true } }),
  ]);

  const days = new Map<string, Day>();
  const get = (d: string) => {
    let v = days.get(d);
    if (!v) days.set(d, (v = { present: 0, half: 0, absent: 0, labour: 0, material: 0, other: 0 }));
    return v;
  };
  for (const a of att) {
    const d = get(a.date);
    if (a.status === "PRESENT") d.present++;
    else if (a.status === "HALF") d.half++;
    else d.absent++;
  }
  pays.forEach((p) => (get(p.date).labour += p.amount));
  mats.forEach((m) => (get(m.date).material += m.total));
  exps.forEach((e) => (get(e.date).other += e.amount));

  const firstWeekday = parseISODate(`${month}-01`).getDay();
  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth(month); d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const t = today();

  const all = [...days.values()];
  const manDays = all.reduce((s, d) => s + d.present + d.half / 2, 0);
  const workingDays = all.filter((d) => d.present + d.half > 0).length;
  const spent = all.reduce((s, d) => s + d.labour + d.material + d.other, 0);

  return (
    <>
      <PageHeader title="Calendar" subtitle="Attendance and spending day by day. Click a day to mark attendance.">
        <MonthNav month={month} basePath="/calendar" />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Working days" value={workingDays} />
        <Stat label="Man-days" value={manDays} hint={workingDays ? `avg ${(manDays / workingDays).toFixed(1)} workers/day` : undefined} />
        <Stat label="Active workers" value={activeWorkers} />
        <Stat label="Spent this month" value={inr(spent)} tone="orange" />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-stone-600">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> present</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> half day</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> absent</span>
          <span className="text-brand-700">L = labour paid</span>
          <span className="text-sky-700">M = materials</span>
          <span className="text-violet-700">E = other expenses</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b border-stone-200 pb-1 text-center text-xs font-semibold uppercase text-stone-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 pt-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="min-h-24 rounded-lg bg-stone-50" />;
                const v = days.get(d);
                const isToday = d === t;
                const future = d > t;
                return (
                  <Link
                    key={d}
                    href={`/attendance?date=${d}`}
                    className={`group min-h-24 rounded-lg border p-2 text-xs transition hover:border-brand-500 hover:shadow ${
                      isToday ? "border-brand-500 ring-2 ring-brand-100" : "border-stone-200"
                    } ${future ? "bg-stone-50/60 text-stone-400" : "bg-white"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${isToday ? "rounded bg-brand-600 px-1.5 text-white" : ""}`}>{Number(d.slice(8))}</span>
                      {v && v.present + v.half + v.absent > 0 && (
                        <span className="flex gap-1 font-medium">
                          {v.present > 0 && <span className="text-emerald-600">{v.present}</span>}
                          {v.half > 0 && <span className="text-amber-600">{v.half}</span>}
                          {v.absent > 0 && <span className="text-rose-600">{v.absent}</span>}
                        </span>
                      )}
                    </div>
                    {v && (
                      <div className="mt-1 space-y-0.5 tabular-nums">
                        {v.labour > 0 && <div className="text-brand-700">L {inrShort(v.labour)}</div>}
                        {v.material > 0 && <div className="text-sky-700">M {inrShort(v.material)}</div>}
                        {v.other > 0 && <div className="text-violet-700">E {inrShort(v.other)}</div>}
                      </div>
                    )}
                    {!v && !future && activeWorkers > 0 && (
                      <div className="mt-2 hidden text-[10px] text-stone-400 group-hover:block">+ mark attendance</div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
