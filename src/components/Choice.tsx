"use client";

import { useEffect, useState } from "react";

type Opt = { value: string; label: string };

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(`pms:${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, v: string) {
    try {
      localStorage.setItem(`pms:${key}`, v);
    } catch {}
  },
};

/** Remember a value in this browser (e.g. last payment mode / supplier). */
export const remembered = store;

/**
 * One-tap buttons instead of a dropdown, for short lists (Cash / GPay / Bank, wage type, category…).
 * Submits as a normal form field `name`. With `remember`, the last choice is kept in this browser.
 */
export function Choice({
  name,
  options,
  defaultValue,
  remember,
  label,
  value: controlled,
  onChange,
  className = "",
}: {
  name: string;
  options: readonly Opt[] | readonly string[];
  defaultValue?: string;
  remember?: string;
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  const opts: Opt[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [own, setOwn] = useState(defaultValue ?? opts[0]?.value ?? "");
  const value = controlled ?? own;

  useEffect(() => {
    if (!remember || controlled !== undefined) return;
    const saved = store.get(remember);
    if (saved !== null && opts.some((o) => o.value === saved)) setOwn(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember]);

  const pick = (v: string) => {
    if (controlled === undefined) setOwn(v);
    if (remember) store.set(remember, v);
    onChange?.(v);
  };

  return (
    <div className={className}>
      {label && <span className="label">{label}</span>}
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label ?? name}>
        {opts.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(o.value)}
              className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition sm:min-h-9 ${
                on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Paid by" as buttons: each partner + the common project fund. Renders nothing without partners. */
export function PaidByChoice({
  partners,
  defaultId,
  label = "Paid by",
  fundLabel = "Project fund",
}: {
  partners: { id: number; name: string }[];
  defaultId?: number | null;
  label?: string;
  fundLabel?: string;
}) {
  if (partners.length === 0) return null;
  return (
    <Choice
      name="paidById"
      label={label}
      defaultValue={defaultId ? String(defaultId) : ""}
      options={[...partners.map((p) => ({ value: String(p.id), label: p.name })), { value: "", label: fundLabel }]}
    />
  );
}

/** Short labels for the payment mode buttons. */
export const MODE_BUTTONS = [
  { value: "CASH", label: "Cash" },
  { value: "GPAY", label: "GPay / UPI" },
  { value: "BANK", label: "Bank" },
] as const;

export function ModeChoice({ label = "Paid via", defaultValue = "CASH" }: { label?: string; defaultValue?: string }) {
  return <Choice name="mode" label={label} options={MODE_BUTTONS} defaultValue={defaultValue} remember="mode" />;
}
