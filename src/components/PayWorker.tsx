"use client";

import { useState } from "react";
import { addLabourPayment } from "@/lib/actions";
import { Choice, ModeChoice, PaidByChoice } from "./Choice";
import { SubmitButton } from "./buttons";

export type PayWorkerRow = { id: number; name: string; role: string; dailyWage: number; due: number; upiId?: string | null };

const TYPES = [
  { value: "DAILY", label: "Wages" },
  { value: "ADVANCE", label: "Advance" },
  { value: "SETTLEMENT", label: "Settlement" },
];

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/**
 * Pay a worker in about 3 taps: pick the worker (amount fills in with what is due), check mode, Pay.
 * Search box finds a worker by name or role.
 */
export function PayWorker({
  workers,
  partners,
  defaultPartnerId,
  date,
  today,
}: {
  workers: PayWorkerRow[];
  partners: { id: number; name: string }[];
  defaultPartnerId?: number;
  /** fixed date (e.g. the attendance day); otherwise a date field under "More details" */
  date?: string;
  today: string;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<PayWorkerRow | null>(null);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("DAILY");
  const [saved, setSaved] = useState(0);

  const needle = q.trim().toLowerCase();
  const list = workers
    .filter((w) => !needle || w.name.toLowerCase().includes(needle) || w.role.toLowerCase().includes(needle))
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));

  const choose = (w: PayWorkerRow) => {
    setSel(w);
    setAmount(String(Math.round(w.due > 0 ? w.due : w.dailyWage)));
    setType(w.due > 0 ? "DAILY" : "ADVANCE");
  };
  const amt = Number(amount) || 0;

  return (
    <form
      key={saved}
      action={async (f) => {
        await addLabourPayment(f);
        setSel(null);
        setQ("");
        setAmount("");
        setType("DAILY");
        setSaved((n) => n + 1);
      }}
      className="space-y-3"
    >
      <input
        type="search"
        data-search
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${workers.length} workers…`}
        className="input min-h-11 sm:min-h-0"
        aria-label="Search workers"
      />

      <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-1">
        {list.length === 0 && <p className="p-3 text-center text-sm text-stone-500">No worker matches “{q}”.</p>}
        {list.map((w) => {
          const on = sel?.id === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => choose(w)}
              aria-pressed={on}
              className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition ${
                on ? "bg-stone-900 text-white" : "hover:bg-stone-100"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{w.name}</span>
                <span className={`block truncate text-xs ${on ? "text-stone-300" : "text-stone-500"}`}>{w.role} · {fmt(w.dailyWage)}/day</span>
              </span>
              <span
                className={`shrink-0 text-xs font-semibold tabular-nums ${
                  on ? "text-white" : w.due > 0.5 ? "text-rose-600" : w.due < -0.5 ? "text-amber-600" : "text-stone-400"
                }`}
              >
                {w.due > 0.5 ? `${fmt(w.due)} due` : w.due < -0.5 ? `advance ${fmt(-w.due)}` : "no dues"}
              </span>
            </button>
          );
        })}
      </div>

      {sel && (
        <>
          <input type="hidden" name="workerId" value={sel.id} />
          <label className="block">
            <span className="label">Amount (₹)</span>
            <input
              name="amount"
              type="number"
              min="1"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input min-h-11 text-lg font-semibold sm:min-h-0"
            />
          </label>
          <Choice name="type" label="Type" options={TYPES} value={type} onChange={setType} />
          <ModeChoice upi={{ payee: sel.name, upiId: sel.upiId, amount: amt, purpose: type === "ADVANCE" ? "Advance" : "Wages" }} />
          <PaidByChoice partners={partners} defaultId={defaultPartnerId} />
          <details className="text-sm">
            <summary className="cursor-pointer py-1 text-stone-600">More details</summary>
            <div className="mt-2 space-y-3">
              {date ? (
                <input type="hidden" name="date" value={date} />
              ) : (
                <label className="block">
                  <span className="label">Date</span>
                  <input name="date" type="date" defaultValue={today} className="input" />
                </label>
              )}
              <label className="block">
                <span className="label">Note</span>
                <input name="note" className="input" placeholder="UPI ref, advance for 5 days…" />
              </label>
            </div>
          </details>
          <SubmitButton className="btn-primary min-h-11 w-full sm:min-h-0">{amt > 0 ? `Pay ${fmt(amt)} to ${sel.name}` : "Pay"}</SubmitButton>
        </>
      )}
      {!sel && <p className="text-xs text-stone-500">Tap a worker – the amount due fills in by itself.</p>}
    </form>
  );
}
