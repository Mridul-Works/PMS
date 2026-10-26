import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { dealSummary } from "@/lib/calc";
import { inr, prettyDate, today } from "@/lib/format";
import { Badge, Bar, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { DealForm } from "@/components/DealForm";
import { getPartnerContext } from "@/lib/partners";

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ dir?: string; show?: string }> }) {
  const sp = await searchParams;
  const dir = sp.dir === "RECEIVE" ? "RECEIVE" : "PAY";
  const t = today();
  const site = (await getCurrentSite())!;
  const ctx = await getPartnerContext(site.id);
  const deals = await prisma.deal.findMany({
    where: { siteId: site.id },
    include: { payments: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  const rows = deals.map((d) => ({ ...d, s: dealSummary(d, t) }));
  const sum = (direction: string, f: (r: (typeof rows)[number]) => number) =>
    rows.filter((r) => r.direction === direction).reduce((a, r) => a + f(r), 0);

  const list = rows.filter((r) => r.direction === dir && (sp.show === "all" || !r.s.complete));
  const doneCount = rows.filter((r) => r.direction === dir && r.s.complete).length;
  const pay = dir === "PAY";

  const tab = (d: string, label: string) => (
    <Link
      href={`/deals?dir=${d}`}
      className={`rounded-md px-4 py-1.5 text-sm font-medium ${dir === d ? (d === "PAY" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white") : "text-stone-600 hover:bg-white"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Part Payments" subtitle="A fixed total paid or received in parts – advance now, rest later (in ₹ or %)">
        <div className="flex rounded-lg bg-stone-200/70 p-1">
          {tab("PAY", "↑ We pay")}
          {tab("RECEIVE", "↓ We receive")}
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="We have to pay (total)" value={inr(sum("PAY", (r) => r.totalAmount))} hint={`Paid ${inr(sum("PAY", (r) => r.s.done))}`} />
        <Stat label="Still to pay" value={inr(sum("PAY", (r) => Math.max(0, r.s.remaining)))} tone="red" />
        <Stat label="We will receive (total)" value={inr(sum("RECEIVE", (r) => r.totalAmount))} hint={`Received ${inr(sum("RECEIVE", (r) => r.s.done))}`} />
        <Stat label="Still to receive" value={inr(sum("RECEIVE", (r) => Math.max(0, r.s.remaining)))} tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={pay ? "Payments we owe in parts" : "Money we receive in parts"}
          action={
            doneCount > 0 && (
              <Link href={sp.show === "all" ? `/deals?dir=${dir}` : `/deals?dir=${dir}&show=all`} className="text-xs text-brand-700 hover:underline">
                {sp.show === "all" ? "Hide completed" : `Show ${doneCount} completed`}
              </Link>
            )
          }
        >
          {list.length === 0 ? (
            <Empty>
              {pay
                ? "Nothing pending. Add a contract / bill with a total amount and record the advance."
                : "Nothing to receive. Add an amount you will receive in parts."}
            </Empty>
          ) : (
            <div className="space-y-3">
              {list.map((r) => (
                <Link key={r.id} href={`/deals/${r.id}`} className="block rounded-lg border border-stone-200 p-3 transition hover:border-brand-500 hover:shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.party}</div>
                      <div className="text-sm text-stone-500">
                        {r.title !== r.party && `${r.title} · `}
                        {r.category} · since {prettyDate(r.date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-stone-500">
                        {inr(r.s.done)} of <b className="text-stone-900">{inr(r.totalAmount)}</b>
                      </div>
                      {r.s.complete ? (
                        <Badge tone="PRESENT">{r.s.remaining < -0.5 ? `Over by ${inr(-r.s.remaining)}` : pay ? "Fully paid" : "Fully received"}</Badge>
                      ) : (
                        <div className={`font-semibold tabular-nums ${pay ? "text-rose-600" : "text-emerald-600"}`}>{inr(r.s.remaining)} left</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Bar value={r.s.done} max={r.totalAmount} color={pay ? "bg-rose-500" : "bg-emerald-500"} />
                    <span className="w-12 text-right text-xs font-semibold tabular-nums">{Math.round(r.s.pct)}%</span>
                  </div>
                  {(r.s.overdue.length > 0 || r.s.nextDue) && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {r.s.overdue.length > 0 && (
                        <Badge tone="DUE">
                          {r.s.overdue.length} overdue · {inr(r.s.overdue.reduce((a, p) => a + p.amount, 0))}
                        </Badge>
                      )}
                      {r.s.nextDue && (
                        <Badge tone="HALF">
                          Next: {inr(r.s.nextDue.amount)} on {prettyDate(r.s.nextDue.date)}
                        </Badge>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="New part-payment deal">
          <DealForm today={t} defaultDirection={dir} key={dir} partners={ctx.partners} defaultPartnerId={ctx.defaultId} />
        </Card>
      </div>
    </>
  );
}
