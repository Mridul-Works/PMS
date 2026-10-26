"use client";

import { useState } from "react";
import { addMaterial } from "@/lib/actions";
import { MATERIALS, PAYMENT_MODES, UNITS } from "@/lib/constants";
import { SubmitButton } from "./buttons";
import { AmountField } from "./AmountField";
import { PaidBySelect } from "./ui";

export function MaterialForm({
  today,
  suppliers,
  partners,
  defaultPartnerId,
}: {
  today: string;
  suppliers: string[];
  partners: { id: number; name: string }[];
  defaultPartnerId?: number;
}) {
  const [material, setMaterial] = useState(MATERIALS[0].name);
  const [unit, setUnit] = useState(MATERIALS[0].unit);
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [saved, setSaved] = useState(0); // bump to reset the ₹/% field after saving
  const total = (Number(qty) || 0) * (Number(rate) || 0);

  return (
    <form
      action={async (f) => {
        await addMaterial(f);
        setQty("");
        setRate("");
        setSaved((n) => n + 1);
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="label">Material *</span>
        <select
          name="material"
          className="input"
          value={material}
          onChange={(e) => {
            setMaterial(e.target.value);
            setUnit(MATERIALS.find((m) => m.name === e.target.value)?.unit ?? "lot");
          }}
        >
          {MATERIALS.map((m) => (
            <option key={m.name}>{m.name}</option>
          ))}
        </select>
      </label>
      {material === "Other" && <input name="materialOther" placeholder="Material name" className="input" required />}

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="label">Quantity *</span>
          <input name="quantity" type="number" step="any" min="0" required value={qty} onChange={(e) => setQty(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="label">Unit</span>
          <select name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="input px-2">
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Rate / {unit}</span>
          <input name="rate" type="number" step="any" min="0" required value={rate} onChange={(e) => setRate(e.target.value)} className="input" />
        </label>
      </div>
      <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
        Total: <b className="tabular-nums">₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</b>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <AmountField key={saved} name="paid" label="Paid now (₹ or %)" total={total} placeholder="empty = paid in full" quick={[0, 20, 25, 50]} />
        </div>
        <label className="block">
          <span className="label">Paid via</span>
          <select name="mode" className="input">
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2">
          <PaidBySelect partners={partners} defaultId={defaultPartnerId} />
        </div>
        <label className="block">
          <span className="label">Supplier</span>
          <input name="supplier" list="suppliers" className="input" />
          <datalist id="suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="label">Date</span>
          <input name="date" type="date" defaultValue={today} className="input" />
        </label>
        <label className="block">
          <span className="label">Bill / challan no.</span>
          <input name="billNo" className="input" />
        </label>
        <label className="block">
          <span className="label">Note</span>
          <input name="note" className="input" placeholder="brand, size…" />
        </label>
      </div>
      <p className="text-xs text-stone-500">Leave “Paid now” empty if paid in full. Enter part (e.g. 20%) to track the rest as supplier due and pay it later.</p>
      <SubmitButton>Add purchase</SubmitButton>
    </form>
  );
}
