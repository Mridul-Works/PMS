"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { switchSite } from "@/lib/actions";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/calendar", label: "Calendar", icon: "▤" },
  { href: "/attendance", label: "Attendance", icon: "✓" },
  { href: "/workers", label: "Workers", icon: "☺" },
  { href: "/payments", label: "Labour Payments", icon: "₹" },
  { href: "/deals", label: "Part Payments", icon: "%" },
  { href: "/materials", label: "Materials", icon: "▣" },
  { href: "/expenses", label: "Other Expenses", icon: "◈" },
  { href: "/investments", label: "Funds / Investment", icon: "↗" },
  { href: "/sites", label: "Sites & Budget", icon: "⌂" },
];

export function Sidebar({ sites, currentId }: { sites: { id: number; name: string }[]; currentId?: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-bold">🏗️ Site Manager</span>
        <button className="btn-ghost px-3 py-1" onClick={() => setOpen(!open)} aria-label="Menu">
          ☰
        </button>
      </div>

      <aside
        className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-stone-200 bg-stone-900 text-stone-200 lg:block`}
      >
        <div className="px-5 py-5">
          <div className="text-lg font-bold text-white">🏗️ Site Manager</div>
          <div className="text-xs text-stone-400">Construction project tracker</div>
        </div>

        {sites.length > 0 && (
          <form action={switchSite} className="px-4 pb-4">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-stone-400">Current site</label>
            <select
              name="siteId"
              defaultValue={currentId}
              key={currentId}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-white outline-none"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </form>
        )}

        <nav className="space-y-0.5 px-3 pb-6">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active(n.href) ? "bg-brand-600 font-medium text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <span className="w-4 text-center opacity-80">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
