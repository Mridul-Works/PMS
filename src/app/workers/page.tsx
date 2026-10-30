import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { addWorkersBulk, saveWorker } from "@/lib/actions";
import { workerBalances } from "@/lib/calc";
import { WORKER_ROLES } from "@/lib/constants";
import { inr, today } from "@/lib/format";
import { Badge, Card, Empty, Field, PageHeader, Select, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";

export default async function WorkersPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  const { show, q } = await searchParams;
  const needle = (q ?? "").trim().toLowerCase();
  const site = (await getCurrentSite())!;
  const [workers, attendance, payments] = await Promise.all([
    prisma.worker.findMany({ where: { siteId: site.id }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.attendance.findMany({ where: { siteId: site.id }, select: { workerId: true, status: true, overtime: true } }),
    prisma.labourPayment.findMany({ where: { siteId: site.id }, select: { workerId: true, amount: true } }),
  ]);
  const bal = workerBalances(workers, attendance, payments);
  const list = (show === "all" ? workers : workers.filter((w) => w.active)).filter(
    (w) => !needle || w.name.toLowerCase().includes(needle) || w.role.toLowerCase().includes(needle) || (w.phone ?? "").includes(needle),
  );
  const balances = [...bal.values()];
  const totalOwed = balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const totalAdvance = balances.filter((b) => b.balance < 0).reduce((s, b) => s - b.balance, 0);
  const dailyCost = workers.filter((w) => w.active).reduce((s, w) => s + w.dailyWage, 0);

  return (
    <>
      <PageHeader title="Workers" subtitle="Labour, mistri and staff at this site with their running balance" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active workers" value={workers.filter((w) => w.active).length} />
        <Stat label="Daily wage bill" value={inr(dailyCost)} hint="if everyone is present" />
        <Stat label="We owe (unpaid wages)" value={inr(totalOwed)} tone="red" />
        <Stat label="Advance given (to recover)" value={inr(totalAdvance)} tone="orange" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="All workers"
          action={
            <Link href={show === "all" ? "/workers" : "/workers?show=all"} className="text-xs text-brand-700 hover:underline">
              {show === "all" ? "Hide inactive" : "Show inactive too"}
            </Link>
          }
        >
          <form className="mb-4 flex gap-2" action="/workers">
            {show === "all" && <input type="hidden" name="show" value="all" />}
            <input
              type="search"
              name="q"
              data-search
              defaultValue={q ?? ""}
              placeholder={`Search ${workers.length} workers by name, role or phone…`}
              aria-label="Search workers"
              className="input min-h-11 flex-1 sm:min-h-0"
            />
            <button className="btn-ghost min-h-11 sm:min-h-0">Search</button>
            {needle && (
              <Link href={show === "all" ? "/workers?show=all" : "/workers"} className="btn-ghost min-h-11 sm:min-h-0">
                Clear
              </Link>
            )}
          </form>
          {list.length === 0 ? (
            <Empty>{needle ? `No worker matches “${q}”.` : "No workers yet. Add your first worker using the form."}</Empty>
          ) : (
            <div className="-m-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th className="text-right">Wage/day</th>
                    <th className="text-right">Days</th>
                    <th className="text-right">Earned</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((w) => {
                    const b = bal.get(w.id)!;
                    return (
                      <tr key={w.id} className="hover:bg-stone-50">
                        <td>
                          <Link href={`/workers/${w.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                            {w.name}
                          </Link>
                          {!w.active && (
                            <span className="ml-2">
                              <Badge>inactive</Badge>
                            </span>
                          )}
                          {w.phone && <div className="text-xs text-stone-500">{w.phone}</div>}
                        </td>
                        <td className="text-stone-600">{w.role}</td>
                        <td className="text-right tabular-nums">{inr(w.dailyWage)}</td>
                        <td className="text-right tabular-nums">{b.daysPresent + b.halfDays / 2}</td>
                        <td className="text-right tabular-nums">{inr(b.earned)}</td>
                        <td className="text-right tabular-nums">{inr(b.paid)}</td>
                        <td className="text-right font-semibold tabular-nums">
                          {b.balance > 0 ? (
                            <span className="text-rose-600">{inr(b.balance)} due</span>
                          ) : b.balance < 0 ? (
                            <span className="text-amber-600">{inr(-b.balance)} adv.</span>
                          ) : (
                            <span className="text-emerald-600">settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-6 text-xs text-stone-500">
            <b>Due</b> = wages earned but not yet paid. <b>Adv.</b> = paid more than earned (advance to be adjusted).
          </p>
        </Card>

        <div className="space-y-6">
        <Card title="Add worker" id="add">
          <form action={saveWorker} className="space-y-3">
            <Field label="Name *">
              <input name="name" required className="input" placeholder="e.g. Ramesh Kumar" />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" inputMode="tel" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <Select name="role" options={WORKER_ROLES} defaultValue="Labour" />
              </Field>
              <Field label="Daily wage (₹) *">
                <input name="dailyWage" type="number" min="0" required className="input" placeholder="600" />
              </Field>
            </div>
            <Field label="Joined on">
              <input name="joinedAt" type="date" defaultValue={today()} className="input" />
            </Field>
            <Field label="Notes">
              <input name="notes" className="input" placeholder="Village, ID, bank details…" />
            </Field>
            <SubmitButton>Add worker</SubmitButton>
          </form>
        </Card>

        <Card title="Paste many workers from Excel">
          <form action={addWorkersBulk} className="space-y-3">
            <textarea
              name="list"
              required
              rows={6}
              className="input font-mono text-xs"
              placeholder={"Ramesh Kumar\tMistri (Mason)\t800\t9876543210\nSuresh\tLabour\t600\nRaju, Helper, 500"}
            />
            <Field label="Joined on">
              <input name="joinedAt" type="date" defaultValue={today()} className="input" />
            </Field>
            <SubmitButton>Add all</SubmitButton>
          </form>
          <p className="mt-3 text-xs text-stone-500">
            Copy the columns <b>Name, Role, Daily wage, Phone</b> from Excel and paste – one worker per line. Role and phone are optional
            (“Raju, 500” works too). A header row is skipped automatically.
          </p>
        </Card>
        </div>
      </div>
    </>
  );
}
