"use client";

import { useState } from "react";

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/**
 * Amount input that accepts either rupees or a % of `total`.
 * Submits `<name>` (the number typed) and `<name>Unit` (RS | PCT); the server converts % to rupees.
 */
export function AmountField({
  name,
  label,
  total,
  remaining,
  required,
  placeholder,
  defaultValue,
  quick = [10, 20, 25, 50],
}: {
  name: string;
  label: string;
  total: number;
  /** if given, a "Rest" quick button fills this amount */
  remaining?: number;
  required?: boolean;
  placeholder?: string;
  defaultValue?: number;
  quick?: number[];
}) {
  const [unit, setUnit] = useState<"RS" | "PCT">("RS");
  const [value, setValue] = useState(defaultValue ? String(defaultValue) : "");
  const n = Number(value) || 0;
  const rupees = unit === "PCT" ? (total * n) / 100 : n;

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex">
        <input
          name={name}
          type="number"
          min="0"
          step="any"
          max={unit === "PCT" ? 100 : undefined}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          className="input min-h-11 min-w-0 flex-1 rounded-r-none sm:min-h-0"
        />
        <input type="hidden" name={`${name}Unit`} value={unit} />
        {/* rupee value for other widgets (e.g. Google Pay button); not submitted */}
        <input type="hidden" data-rupees={name} value={rupees ? String(Math.round(rupees * 100) / 100) : ""} />
        <div className="flex shrink-0 overflow-hidden rounded-r-lg border border-l-0 border-stone-300 text-sm">
          {(["RS", "PCT"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                // convert the typed value so the amount stays the same
                if (u !== unit && n && total) setValue(String(+(u === "PCT" ? (n / total) * 100 : (total * n) / 100).toFixed(2)));
                setUnit(u);
              }}
              className={`min-w-11 px-3 font-semibold ${unit === u ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
            >
              {u === "RS" ? "₹" : "%"}
            </button>
          ))}
        </div>
      </div>
      {total > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-1">
          {quick.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setUnit("PCT");
                setValue(String(p));
              }}
              className="min-h-11 rounded-full bg-stone-100 px-3 text-xs font-medium text-stone-600 hover:bg-brand-100 hover:text-brand-700 sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[11px]"
            >
              {p}%
            </button>
          ))}
          {remaining !== undefined && remaining > 0 && (
            <button
              type="button"
              onClick={() => {
                setUnit("RS");
                setValue(String(Math.round(remaining * 100) / 100));
              }}
              className="min-h-11 rounded-full bg-stone-100 px-3 text-xs font-medium text-stone-600 hover:bg-brand-100 hover:text-brand-700 sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[11px]"
            >
              Rest {fmt(remaining)}
            </button>
          )}
          {n > 0 && (
            <span className="ml-auto text-xs text-stone-500">
              {unit === "PCT" ? `= ${fmt(rupees)}` : `= ${((rupees / total) * 100).toFixed(1)}% of ${fmt(total)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
