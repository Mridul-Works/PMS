"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Date box that opens the chosen day straight away (no "Go" button). Keeps other query params. */
export function DateNav({ date, param = "date" }: { date: string; param?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <input
      type="date"
      defaultValue={date}
      key={date}
      aria-label="Date"
      onChange={(e) => {
        if (!e.target.value) return;
        const q = new URLSearchParams(sp.toString());
        q.set(param, e.target.value);
        router.push(`${path}?${q}`);
      }}
      className="input min-h-11 w-auto sm:min-h-0"
    />
  );
}
