import Link from "next/link";
import { ReactNode } from "react";
import { prettyMonth, shiftMonth } from "@/lib/format";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const tones = {
  default: "text-stone-900",
  green: "text-emerald-600",
  red: "text-rose-600",
  orange: "text-brand-600",
  blue: "text-sky-600",
};

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: keyof typeof tones }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  CASH: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  GPAY: "bg-sky-50 text-sky-700 ring-sky-200",
  BANK: "bg-violet-50 text-violet-700 ring-violet-200",
  ADVANCE: "bg-amber-50 text-amber-700 ring-amber-200",
  DAILY: "bg-stone-50 text-stone-700 ring-stone-200",
  SETTLEMENT: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PRESENT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  HALF: "bg-amber-50 text-amber-700 ring-amber-200",
  ABSENT: "bg-rose-50 text-rose-700 ring-rose-200",
  DUE: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function Badge({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone ?? ""] ?? "bg-stone-50 text-stone-700 ring-stone-200"}`}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{children}</div>;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Select({ name, options, defaultValue, required }: { name: string; options: readonly { value: string; label: string }[] | readonly string[]; defaultValue?: string; required?: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue} required={required} className="input">
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}

/** ‹ October 2026 › navigation that keeps other query params */
export function MonthNav({ month, basePath, params = {} }: { month: string; basePath: string; params?: Record<string, string> }) {
  const href = (m: string) => `${basePath}?${new URLSearchParams({ ...params, month: m })}`;
  return (
    <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
      <Link href={href(shiftMonth(month, -1))} className="px-3 py-2 text-stone-600 hover:bg-stone-50" aria-label="Previous month">‹</Link>
      <span className="min-w-36 px-2 text-center text-sm font-medium">{prettyMonth(month)}</span>
      <Link href={href(shiftMonth(month, 1))} className="px-3 py-2 text-stone-600 hover:bg-stone-50" aria-label="Next month">›</Link>
    </div>
  );
}

/** Horizontal share bar */
export function Bar({ value, max, color = "bg-brand-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
