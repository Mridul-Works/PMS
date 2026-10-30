import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth";
import { addInvestment, deleteInvestment, deletePartner, savePartner } from "@/lib/actions";
import { PAYMENT_MODES, modeLabel } from "@/lib/constants";
import { inr, prettyDate, today } from "@/lib/format";
import { getTotals } from "@/lib/totals";
import Link from "next/link";
import { getPartnerContext, getPartnerLedger, getPartnerReport, LEDGER_KINDS } from "@/lib/partners";
import { Badge, Bar, Card, Empty, Field, PageHeader, PaidBySelect, Select, Stat } from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/buttons";

const COLORS = ["bg-brand-500", "bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-rose-500", "bg-amber-500"];

export default async function PartnersFundsPage({ searchParams }: { searchParams: Promise<{ partner?: string; kind?: string }> }) {
  const sp = await searchParams;
  const site = (await getCurrentSite())!;
  const me = await getCurrentUser();
  const isAdmin = me?.role === "ADMIN";
  const [list, totals, report, ctx, users, ledger] = await Promise.all([
    prisma.investment.findMany({ where: { siteId: site.id }, include: { paidBy: true }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
    getTotals(site.id),
    getPartnerReport(site.id),
    getPartnerContext(site.id),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getPartnerLedger(site.id),
  ]);
  const { rows } = report;
  const maxNet = Math.max(1, ...rows.map((r) => r.net));

  // "Who paid for what": selected partner tab ("fund" = project fund / outside money)
  const fundEntries = ledger.filter((e) => e.partnerId === null);
  const tabs = [
    ...rows.map((r, i) => ({ key: String(r.id), label: r.name, color: COLORS[i % COLORS.length], entries: ledger.filter((e) => e.partnerId === r.id) })),
    ...(fundEntries.length ? [{ key: "fund", label: "Project fund / others", color: "bg-stone-400", entries: fundEntries }] : []),
  ];
  const active = tabs.find((t) => t.key === sp.partner) ?? tabs[0];
  const kindTotals = LEDGER_KINDS.map((k) => ({
    ...k,
    count: active?.entries.filter((e) => e.kind === k.kind).length ?? 0,
    total: active?.entries.filter((e) => e.kind === k.kind).reduce((s, e) => s + e.amount, 0) ?? 0,
  })).filter((k) => k.count > 0);
  const kind = kindTotals.find((k) => k.kind === sp.kind)?.kind;
  const shown = active ? active.entries.filter((e) => !kind || e.kind === kind) : [];
  const tabHref = (partner: string, k?: string) => `?${new URLSearchParams({ partner, ...(k ? { kind: k } : {}) })}#details`;

  return (
    <>
      <PageHeader title="Partners & Funds" subtitle="Who put how much money into this project, and the common project fund" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Put into project fund" value={inr(totals.fundsIn)} tone="blue" hint={totals.fundReceived ? `+ ${inr(totals.fundReceived)} received into fund` : undefined} />
        <Stat label="Spent from fund" value={inr(totals.fundOut)} hint={`Total spent overall ${inr(totals.cashOut)}`} />
        <Stat
          label={totals.fundBalance >= 0 ? "Project fund in hand" : "Fund overspent"}
          value={inr(Math.abs(totals.fundBalance))}
          tone={totals.fundBalance >= 0 ? "green" : "red"}
        />
        <Stat label="Total by partners" value={inr(report.totalNet)} hint={rows.length ? `${rows.length} partner(s)` : "no partners yet"} />
      </div>

      {/* partner contributions */}
      <Card className="mb-6" title="Partner contributions">
        {rows.length === 0 ? (
          <Empty>
            No partners yet. {isAdmin ? "Add partners (e.g. Mridul, Vinay) with the form below" : "Ask an admin to add partners"} – then every payment can be marked
            “Paid by” a partner.
          </Empty>
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th className="text-right">Put in fund</th>
                    <th className="text-right">Paid directly</th>
                    <th className="text-right">Received (kept)</th>
                    <th className="text-right">Net contribution</th>
                    <th className="text-right">Agreed share</th>
                    <th className="text-right">vs share</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const direct = r.labour + r.material + r.expense + r.contract;
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="flex items-center gap-2 font-semibold">
                            <span className={`h-3 w-3 rounded-sm ${COLORS[i % COLORS.length]}`} />
                            {r.name}
                            {!r.active && <Badge>inactive</Badge>}
                          </div>
                          {direct > 0 && (
                            <div className="mt-0.5 text-xs text-stone-500">
                              {[
                                r.labour && `labour ${inr(r.labour)}`,
                                r.material && `materials ${inr(r.material)}`,
                                r.contract && `contracts ${inr(r.contract)}`,
                                r.expense && `expenses ${inr(r.expense)}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="text-right tabular-nums">{inr(r.fundsIn)}</td>
                        <td className="text-right tabular-nums">{inr(direct)}</td>
                        <td className="text-right tabular-nums text-stone-500">{r.received ? `− ${inr(r.received)}` : "–"}</td>
                        <td className="text-right font-bold tabular-nums">
                          {inr(r.net)}
                          <div className="text-xs font-normal text-stone-500">{report.totalNet ? `${((r.net / report.totalNet) * 100).toFixed(1)}% of total` : ""}</div>
                        </td>
                        <td className="text-right tabular-nums">
                          {report.sharesSet ? `${r.sharePct}%` : <span className="text-stone-400">equal</span>}
                          <div className="text-xs text-stone-500">{inr(r.expected)}</div>
                        </td>
                        <td className={`text-right font-semibold tabular-nums ${r.diff > 1 ? "text-emerald-600" : r.diff < -1 ? "text-rose-600" : "text-stone-500"}`}>
                          {Math.abs(r.diff) <= 1 ? "even" : r.diff > 0 ? `+${inr(r.diff)}` : `−${inr(-r.diff)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* share bar */}
            <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-stone-100">
              {rows.map((r, i) =>
                r.net > 0 ? (
                  <div key={r.id} className={COLORS[i % COLORS.length]} style={{ width: `${(r.net / Math.max(report.totalNet, 1)) * 100}%` }} title={`${r.name}: ${inr(r.net)}`} />
                ) : null,
              )}
            </div>

            <div className="mt-4 rounded-lg bg-stone-50 p-3 text-sm">
              <div className="mb-1 font-semibold">Settle up</div>
              {report.settlements.length === 0 ? (
                <p className="text-stone-600">Everyone is even as per the agreed shares. 👍</p>
              ) : (
                <ul className="space-y-1">
                  {report.settlements.map((s, i) => (
                    <li key={i}>
                      <b>{s.from}</b> should give <b>{s.to}</b> <b className="text-brand-700">{inr(s.amount)}</b> to match the agreed shares
                    </li>
                  ))}
                </ul>
              )}
              {report.sharesSet && Math.abs(report.shareTotal - 100) > 0.01 && (
                <p className="mt-1 text-xs text-amber-700">Note: shares add up to {report.shareTotal}%, not 100% – they are scaled proportionally.</p>
              )}
            </div>
            <p className="mt-3 text-xs text-stone-500">
              <b>Net contribution</b> = money put into the project fund + payments made from own pocket − money received from clients that the partner kept.
              Payments marked “Project fund” are not counted for anyone, because that money was already counted when it was put in.
            </p>
          </>
        )}
      </Card>

      {active && (
        <div id="details" className="mb-6 scroll-mt-4">
          <Card title="Who paid for what – every entry">
            {/* partner tabs */}
            <div className="mb-4 flex flex-wrap gap-2">
              {tabs.map((t) => {
                const total = t.entries.reduce((s, e) => s + (e.kind === "RECEIVED" ? -e.amount : e.amount), 0);
                const on = t.key === active.key;
                return (
                  <Link
                    key={t.key}
                    href={tabHref(t.key)}
                    scroll={false}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${on ? "border-stone-800 bg-stone-900 text-white" : "border-stone-200 bg-white hover:bg-stone-50"}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-sm ${t.color}`} />
                    <span className="font-semibold">{t.label}</span>
                    <span className={`tabular-nums ${on ? "text-stone-300" : "text-stone-500"}`}>{inr(total)}</span>
                  </Link>
                );
              })}
            </div>

            {/* what the money went into */}
            {kindTotals.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {kindTotals.map((k) => {
                  const on = k.kind === kind;
                  return (
                    <Link
                      key={k.kind}
                      href={tabHref(active.key, on ? undefined : k.kind)}
                      scroll={false}
                      className={`rounded-lg border p-2.5 ${on ? "border-brand-500 bg-brand-50" : "border-stone-200 hover:bg-stone-50"}`}
                    >
                      <div className="text-xs text-stone-500">{k.label} · {k.count}</div>
                      <div className={`font-bold tabular-nums ${k.kind === "RECEIVED" ? "text-stone-500" : ""}`}>
                        {k.kind === "RECEIVED" ? "− " : ""}{inr(k.total)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {shown.length === 0 ? (
              <Empty>No entries for {active.label} yet.</Empty>
            ) : (
              <div className="-mx-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Paid for</th>
                      <th>Mode</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((e) => (
                      <tr key={e.key}>
                        <td className="whitespace-nowrap">{prettyDate(e.date)}</td>
                        <td className="whitespace-nowrap"><Badge>{LEDGER_KINDS.find((k) => k.kind === e.kind)?.label}</Badge></td>
                        <td>
                          {e.href ? <Link href={e.href} className="font-medium hover:underline">{e.what}</Link> : <span className="font-medium">{e.what}</span>}
                          {e.note && <div className="text-xs text-stone-500">{e.note}</div>}
                        </td>
                        <td><Badge tone={e.mode}>{modeLabel(e.mode)}</Badge></td>
                        <td className={`text-right font-semibold tabular-nums ${e.kind === "RECEIVED" ? "text-stone-500" : ""}`}>
                          {e.kind === "RECEIVED" ? "− " : ""}{inr(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="font-semibold">{kind ? kindTotals.find((k) => k.kind === kind)?.label : "Total"} ({shown.length} entries)</td>
                      <td className="text-right font-bold tabular-nums">
                        {inr(shown.reduce((s, e) => s + (e.kind === "RECEIVED" ? -e.amount : e.amount), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {active.key === "fund" && (
              <p className="mt-3 text-xs text-stone-500">These were paid from the common project fund (or money from outside, like a loan), so they are not counted for any one partner.</p>
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Money put into the project fund">
            {list.length === 0 ? (
              <Empty>No funds recorded yet.</Empty>
            ) : (
              <div className="-m-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>From</th>
                      <th>Mode</th>
                      <th>Note</th>
                      <th className="text-right">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => (
                      <tr key={i.id}>
                        <td className="whitespace-nowrap">{prettyDate(i.date)}</td>
                        <td className="font-medium">
                          {i.paidBy?.name ?? i.source}
                          {!i.paidBy && <span className="ml-1 text-xs font-normal text-stone-500">(not a partner)</span>}
                        </td>
                        <td><Badge tone={i.mode}>{modeLabel(i.mode)}</Badge></td>
                        <td className="text-stone-600">{i.note}</td>
                        <td className="text-right font-semibold tabular-nums">{inr(i.amount)}</td>
                        <td className="text-right">
                          <form action={deleteInvestment}>
                            <input type="hidden" name="id" value={i.id} />
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

          {isAdmin && rows.length > 0 && (
            <Card title="Edit partners">
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li key={r.id} className="rounded-lg border border-stone-200 p-3">
                    <details>
                      <summary className="cursor-pointer text-sm">
                        <b>{r.name}</b> · share {r.sharePct}%{r.userId && (
                          <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">login: {users.find((u) => u.id === r.userId)?.name ?? "?"}</span>
                        )}
                      </summary>
                      <form action={savePartner} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="id" value={r.id} />
                        <Field label="Name"><input name="name" defaultValue={r.name} required className="input" /></Field>
                        <Field label="Agreed share (%)"><input name="sharePct" type="number" min="0" max="100" step="any" defaultValue={r.sharePct} className="input" /></Field>
                        <Field label="Phone"><input name="phone" defaultValue={r.phone ?? ""} className="input" /></Field>
                        <Field label="Login user (auto-fills “Paid by”)">
                          <Select name="userId" defaultValue={r.userId ? String(r.userId) : ""} options={[{ value: "", label: "— none —" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
                        </Field>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="active" defaultChecked={r.active} /> Active
                        </label>
                        <div className="sm:col-span-2">
                          <SubmitButton>Save partner</SubmitButton>
                        </div>
                      </form>
                      <form action={deletePartner} className="mt-2">
                        <input type="hidden" name="id" value={r.id} />
                        <DeleteButton label="Remove partner" confirmText={`Remove ${r.name}? Their payments stay but will show as "Project fund".`} />
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Add money to project fund">
            <form action={addInvestment} className="space-y-3">
              <PaidBySelect partners={ctx.partners} defaultId={ctx.defaultId} label="Put in by" fundLabel="Someone else (loan, bank…)" />
              <Field label={ctx.partners.length ? "If someone else – name" : "From (person / bank / loan) *"}>
                <input name="source" required={ctx.partners.length === 0} className="input" placeholder="e.g. Home loan – SBI" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₹) *">
                  <input name="amount" type="number" min="1" step="any" required className="input" />
                </Field>
                <Field label="Date">
                  <input name="date" type="date" defaultValue={today()} className="input" />
                </Field>
              </div>
              <Field label="Mode">
                <Select name="mode" options={PAYMENT_MODES} defaultValue="BANK" />
              </Field>
              <Field label="Note">
                <input name="note" className="input" />
              </Field>
              <SubmitButton>Add funds</SubmitButton>
            </form>
            <p className="mt-3 text-xs text-stone-500">
              Use this when money goes into a common account / cash box. If a partner pays a worker or supplier directly, just pick them in “Paid by” on that payment instead.
            </p>
          </Card>

          {isAdmin && (
            <Card title="Add partner / investor">
              <form action={savePartner} className="space-y-3">
                <Field label="Name *"><input name="name" required className="input" placeholder="e.g. Vinay" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Agreed share (%)"><input name="sharePct" type="number" min="0" max="100" step="any" className="input" placeholder="50" /></Field>
                  <Field label="Phone"><input name="phone" className="input" /></Field>
                </div>
                <Field label="Login user (optional)">
                  <Select name="userId" options={[{ value: "", label: "— none —" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
                </Field>
                <SubmitButton>Add partner</SubmitButton>
              </form>
              <p className="mt-3 text-xs text-stone-500">Leave share empty for equal shares. Example: Mridul 60%, Vinay 40%.</p>
            </Card>
          )}
          {rows.length > 0 && (
            <Card title="Contribution chart">
              <div className="space-y-3">
                {rows.map((r, i) => (
                  <div key={r.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{r.name}</span>
                      <b className="tabular-nums">{inr(r.net)}</b>
                    </div>
                    <Bar value={r.net} max={maxNet} color={COLORS[i % COLORS.length]} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
