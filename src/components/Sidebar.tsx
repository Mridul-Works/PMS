"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { switchSite } from "@/lib/actions";
import { logout } from "@/lib/auth-actions";
import { CLOSE_MENU, jumpToAdd } from "./Shortcuts";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/calendar", label: "Calendar", icon: "▤" },
  { href: "/attendance", label: "Attendance", icon: "✓" },
  { href: "/workers", label: "Workers", icon: "☺" },
  { href: "/payments", label: "Labour Payments", icon: "₹" },
  { href: "/dues", label: "Dues & Part Payments", icon: "⚖" },
  { href: "/deals", label: "Part-Payment Deals", icon: "%" },
  { href: "/materials", label: "Materials", icon: "▣" },
  { href: "/expenses", label: "Other Expenses", icon: "◈" },
  { href: "/investments", label: "Partners & Funds", icon: "↗" },
  { href: "/sites", label: "Sites & Budget", icon: "⌂" },
  { href: "/users", label: "Users & Login", icon: "⚿" },
];

export function Sidebar({
  sites,
  currentId,
  user,
}: {
  sites: { id: number; name: string }[];
  currentId?: number;
  user: { name: string; role: string };
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const siteName = sites.find((s) => s.id === currentId)?.name;

  // close the phone menu on navigation / Esc; arriving on a page with #add (e.g. /payments#add) opens its form
  useEffect(() => {
    setOpen(false);
    if (window.location.hash === "#add") setTimeout(jumpToAdd, 150);
  }, [path]);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener(CLOSE_MENU, close);
    return () => window.removeEventListener(CLOSE_MENU, close);
  }, []);

  const plus = () => {
    setOpen(false);
    if (!jumpToAdd()) router.push("/payments#add");
  };

  const tab = (on: boolean) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-brand-600" : "text-stone-500"}`;

  return (
    <>
      {/* phone top bar: just where you are (the menu lives in "More" at the bottom) */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-2.5 lg:hidden">
        <span className="font-bold">🏗️ Site Manager</span>
        {siteName && <span className="truncate text-xs text-stone-500">{siteName}</span>}
      </div>

      {/* phone bottom bar: Today · Pay · + · Money · More */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.04)] lg:hidden"
        aria-label="Main"
      >
        <div className="flex items-stretch">
          <Link href="/" className={tab(path === "/")}>
            <span className="text-lg leading-none">▦</span>Today
          </Link>
          <Link href="/payments" className={tab(path.startsWith("/payments"))}>
            <span className="text-lg leading-none">₹</span>Pay
          </Link>
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={plus}
              aria-label="Add new entry"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-3xl font-light leading-none text-white shadow-lg ring-4 ring-white active:bg-brand-700"
            >
              +
            </button>
          </div>
          <Link href="/dues" className={tab(path.startsWith("/dues") || path.startsWith("/deals") || path.startsWith("/suppliers"))}>
            <span className="text-lg leading-none">⚖</span>Money
          </Link>
          <button type="button" onClick={() => setOpen(!open)} className={tab(open)} aria-expanded={open} aria-label="More pages">
            <span className="text-lg leading-none">☰</span>More
          </button>
        </div>
      </nav>

      <aside
        className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r border-stone-200 bg-stone-900 text-stone-200 lg:block`}
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
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition lg:min-h-0 ${
                active(n.href) ? "bg-brand-600 font-medium text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <span className="w-4 text-center opacity-80">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="mx-3 mb-6 rounded-lg border border-stone-700 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user.name}</div>
              <div className="text-[11px] text-stone-400">{user.role === "ADMIN" ? "Admin" : "Member"}</div>
            </div>
          </div>
          <form action={logout} className="mt-2">
            <button className="w-full rounded-md bg-stone-800 py-1.5 text-xs text-stone-300 hover:bg-stone-700 hover:text-white">Log out</button>
          </form>
        </div>
        <p className="hidden px-5 pb-6 text-[11px] text-stone-500 lg:block">Shortcuts: N new · / search · Esc close</p>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
