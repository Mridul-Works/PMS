"use client";

import { useEffect, useState } from "react";
import { addMaterial } from "@/lib/actions";
import { MATERIALS, UNITS } from "@/lib/constants";
import { SubmitButton } from "./buttons";
import { AmountField } from "./AmountField";
import { Choice, ModeChoice, PaidByChoice, remembered } from "./Choice";

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

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
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState({ value: "", unit: "RS" });
  const [supplier, setSupplier] = useState("");
  const [saved, setSaved] = useState(0); // bump to reset the ₹/% field after saving

  // last supplier used in this browser
  useEffect(() => {
    setSupplier(remembered.get("supplier") ?? "");
  }, []);

  const qtyRate = (Number(qty) || 0) * (Number(rate) || 0);
  const totalNum = Number(total) || qtyRate;
  const paidNum = paid.value === "" ? totalNum : paid.unit === "PCT" ? (totalNum * (Number(paid.value) || 0)) / 100 : Number(paid.value) || 0;
  const stillDue = Math.max(0, totalNum - paidNum);
  const needSupplier = stillDue > 0.5;

  return (
    <form
      action={async (f) => {
        if (supplier.trim()) remembered.set("supplier", supplier.trim());
        await addMaterial(f);
        setQty("");
        setRate("");
        setTotal("");
        setPaid({ value: "", unit: "RS" });
        setSaved((n) => n + 1);
      }}
      onInput={(e) => {
        // track the "Paid now" field (inside AmountField) to know what stays due
        const form = e.currentTarget;
        const v = (form.elements.namedItem("paid") as HTMLInputElement | null)?.value ?? "";
        const u = (form.elements.namedItem("paidUnit") as HTMLInputElement | null)?.value ?? "RS";
        if (v !== paid.value || u !== paid.unit) setPaid({ value: v, unit: u });
      }}
      onClick={(e) => {
        // ₹/% toggle and quick buttons change the field without an input event
        const form = e.currentTarget;
        requestAnimationFrame(() => {
          const v = (form.elements.namedItem("paid") as HTMLInputElement | null)?.value ?? "";
          const u = (form.elements.namedItem("paidUnit") as HTMLInputElement | null)?.value ?? "RS";
          setPaid((p) => (p.value === v && p.unit === u ? p : { value: v, unit: u }));
        });
      }}
      className="space-y-3"
    >
      <Choice
        name="material"
        label="Material *"
        options={MATERIALS.map((m) => m.name)}
        value={material}
        onChange={(v) => {
          setMaterial(v);
          setUnit(MATERIALS.find((m) => m.name === v)?.unit ?? "lot");
        }}
      />
      {material === "Other" && <input name="materialOther" placeholder="Material name" className="input" required />}

      <label className="block">
        <span className="label">Total bill (₹) *</span>
        <input
          name="total"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          required={qtyRate <= 0}
          value={total}
          placeholder={qtyRate > 0 ? `${Math.round(qtyRate)} (qty × rate)` : ""}
          onChange={(e) => setTotal(e.target.value)}
          className="input min-h-11 text-base sm:min-h-0 sm:text-sm"
        />
      </label>

      <AmountField key={saved} name="paid" label="Paid now (₹ or %)" total={totalNum} placeholder="empty = paid in full" quick={[0, 20, 25, 50]} />

      <label className="block">
        <span className="label">Supplier{needSupplier ? " *" : ""}</span>
        <input
          name="supplier"
          list="suppliers"
          className="input min-h-11 sm:min-h-0"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          required={needSupplier}
        />
        <datalist id="suppliers">
          {suppliers.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {needSupplier && <span className="mt-1 block text-xs text-rose-600">Needed because {fmt(stillDue)} stays due</span>}
      </label>

      <ModeChoice />
      <PaidByChoice partners={partners} defaultId={defaultPartnerId} />

      <details className="rounded-lg border border-stone-200 px-3 py-2">
        <summary className="cursor-pointer py-1 text-sm font-medium text-stone-700">More details (quantity, rate, date, bill no.)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Quantity</span>
              <input name="quantity" type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="label">Rate / {unit}</span>
              <input name="rate" type="number" inputMode="decimal" step="any" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className="input" />
            </label>
          </div>
          <Choice name="unit" label="Unit" options={UNITS} value={unit} onChange={setUnit} />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Date</span>
              <input name="date" type="date" defaultValue={today} className="input" />
            </label>
            <label className="block">
              <span className="label">Bill / challan no.</span>
              <input name="billNo" className="input" />
            </label>
          </div>
          <label className="block">
            <span className="label">Note</span>
            <input name="note" className="input" placeholder="brand, size…" />
          </label>
        </div>
      </details>

      <SubmitButton className="btn-primary min-h-11 w-full sm:w-auto">Add purchase</SubmitButton>
    </form>
  );
}
