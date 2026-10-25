import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { deleteSite, switchSite } from "@/lib/actions";
import { getTotals } from "@/lib/totals";
import { inr } from "@/lib/format";
import { Badge, Bar, Card, PageHeader } from "@/components/ui";
import { DeleteButton } from "@/components/buttons";
import { SiteForm } from "@/components/SiteForm";

export default async function SitesPage() {
  const current = (await getCurrentSite())!;
  const sites = await prisma.site.findMany({ orderBy: { id: "asc" } });
  const totals = await Promise.all(sites.map((s) => getTotals(s.id)));

  return (
    <>
      <PageHeader title="Sites & Budget" subtitle="All your construction projects. Each site has its own workers, materials and budget." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {sites.map((s, i) => {
            const t = totals[i];
            return (
              <Card
                key={s.id}
                title={
                  <span className="flex items-center gap-2">
                    {s.name} {s.id === current.id && <Badge tone="PRESENT">current</Badge>}
                  </span>
                }
                action={
                  s.id !== current.id && (
                    <form action={switchSite}>
                      <input type="hidden" name="siteId" value={s.id} />
                      <button className="btn-ghost py-1 text-xs">Switch to this site</button>
                    </form>
                  )
                }
              >
                <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-stone-500">{s.location}</span>
                  <span>
                    Spent <b>{inr(t.totalCost)}</b> {s.budget > 0 && <>of {inr(s.budget)}</>}
                  </span>
                </div>
                {s.budget > 0 && <Bar value={t.totalCost} max={s.budget} color={t.totalCost > s.budget ? "bg-rose-500" : "bg-brand-500"} />}
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-stone-600">
                  <div>Labour: <b>{inr(t.labourPaid)}</b></div>
                  <div>Materials: <b>{inr(t.materialCost)}</b></div>
                  <div>Other: <b>{inr(t.expenseTotal)}</b></div>
                </div>
                {s.id === current.id && (
                  <details className="mt-4 border-t border-stone-100 pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-brand-700">Edit site details / budget</summary>
                    <div className="mt-3">
                      <SiteForm site={s} />
                    </div>
                    <form action={deleteSite} className="mt-4">
                      <input type="hidden" name="id" value={s.id} />
                      <DeleteButton label="Delete this site and ALL its data" confirmText={`Delete "${s.name}" with all workers, attendance, payments, materials and expenses? This cannot be undone.`} />
                    </form>
                  </details>
                )}
              </Card>
            );
          })}
        </div>

        <Card title="Add new site">
          <SiteForm />
        </Card>
      </div>
    </>
  );
}
