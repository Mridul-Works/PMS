"use client";

import { useState } from "react";
import { addDeal } from "@/lib/actions";
import { DEAL_CATEGORIES_PAY, DEAL_CATEGORIES_RECEIVE, PAYMENT_MODES } from "@/lib/constants";
import { AmountField } from "./AmountField";
import { SubmitButton } from "./buttons";

export function DealForm({ today, defaultDirection = "PAY" }: { today: string; defaultDirection?: "PAY" | "RECEIVE" }) {
  const [direction, setDirection] = useState<"PAY" | "RECEIVE">(defaultDirection);
  const [total, setTotal] = useState("");
  const [plan, setPlan] = useState(false);
  const cats = direction === "PAY" ? DEAL_CATEGORIES_PAY : DEAL_CATEGORIES_RECEIVE;
  const pay = direction === "PAY";

  return (
    <form action={addDeal} className="space-y-3">
      <input type="hidden" name="direction" value={direction} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 text-sm font-medium">
        {(["PAY", "RECEIVE"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`rounded-md py-1.5 ${direction === d ? (d === "PAY" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white") : "text-stone-600"}`}
          >
            {d === "PAY" ? "↑ We pay" : "↓ We receive"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="label">{pay ? "Paying to (person / company) *" : "Receiving from *"}</span>
        <input name="party" required className="input" placeholder={pay ? "e.g. Raju Thekedar" : "e.g. Mr. Sharma (client)"} />
      </label>
      <label className="block">
        <span className="label">For what</span>
        <input name="title" className="input" placeholder={pay ? "e.g. Plaster work – full house" : "e.g. 2nd floor booking"} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Category</span>
          <select name="category" className="input" key={direction}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Total amount (₹) *</span>
          <input name="totalAmount" type="number" min="1" step="any" required value={total} onChange={(e) => setTotal(e.target.value)} className="input" placeholder="10000" />
        </label>
      </div>

      <div className="rounded-lg border border-stone-200 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{pay ? "Paid now (advance)" : "Received now"}</div>
        <div className="space-y-3">
          <AmountField name="first" label="Amount or %" total={Number(total) || 0} placeholder="0" quick={[10, 20, 25, 50, 100]} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Date</span>
              <input name="date" type="date" defaultValue={today} className="input" />
            </label>
            <label className="block">
              <span className="label">Mode</span>
              <select name="mode" className="input">
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={plan} onChange={(e) => setPlan(e.target.checked)} />
        Plan the rest in installments (due dates)
      </label>
      {plan && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-dashed border-stone-300 p-3">
          <label className="block">
            <span className="label">How many</span>
            <input name="planCount" type="number" min="1" max="60" defaultValue={2} className="input" />
          </label>
          <label className="block">
            <span className="label">Every (days)</span>
            <input name="planEvery" type="number" min="1" defaultValue={15} className="input" />
          </label>
          <label className="block">
            <span className="label">First due</span>
            <input name="planStart" type="date" className="input px-2" />
          </label>
          <p className="col-span-3 text-xs text-stone-500">The remaining amount is split equally. You can change or delete each installment later.</p>
        </div>
      )}

      <label className="block">
        <span className="label">Note</span>
        <input name="note" className="input" placeholder="terms, rate, scope…" />
      </label>
      <SubmitButton>{pay ? "Save payment deal" : "Save receivable"}</SubmitButton>
    </form>
  );
}
