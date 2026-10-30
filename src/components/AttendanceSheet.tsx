"use client";

import { useRef, useState } from "react";
import { saveAttendance } from "@/lib/actions";
import { SubmitButton } from "./buttons";

type Row = { id: number; name: string; role: string; dailyWage: number; status?: string; overtime?: number };

const OPTIONS = [
  { value: "PRESENT", label: "P", title: "Present", on: "peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600" },
  { value: "HALF", label: "½", title: "Half day", on: "peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500" },
  { value: "ABSENT", label: "A", title: "Absent", on: "peer-checked:bg-rose-600 peer-checked:text-white peer-checked:border-rose-600" },
  { value: "NONE", label: "–", title: "Not marked", on: "peer-checked:bg-stone-500 peer-checked:text-white peer-checked:border-stone-500" },
];

/**
 * Attendance for one day, grouped by role. On a day with nothing marked yet (`fresh`),
 * everyone starts as present, so you only tap the absentees and Save.
 * Field names status_<workerId> / ot_<workerId> are read by saveAttendance.
 */
export function AttendanceSheet({ date, rows, fresh = false }: { date: string; rows: Row[]; fresh?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState("");
  const [extraOpen, setExtraOpen] = useState<Set<number>>(() => new Set(rows.filter((r) => r.overtime).map((r) => r.id)));

  const markAll = (value: string, scope?: HTMLElement | null) => {
    (scope ?? formRef.current)
      ?.querySelectorAll<HTMLInputElement>(`input[type=radio][value=${value}]`)
      .forEach((el) => {
        // only rows that are visible (respects the search box)
        if ((el.closest("[data-row]") as HTMLElement | null)?.style.display !== "none") el.checked = true;
      });
  };
  const toggleExtra = (id: number) =>
    setExtraOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // group by role (stand-in for team / contractor)
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(r.role, [...(groups.get(r.role) ?? []), r]);
  const needle = q.trim().toLowerCase();
  const matches = (r: Row) => !needle || r.name.toLowerCase().includes(needle) || r.role.toLowerCase().includes(needle);

  return (
    <form ref={formRef} action={saveAttendance} key={date}>
      <input type="hidden" name="date" value={date} />
      {fresh && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Everyone starts as present – tap only who is absent or on half day, then Save.
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          data-search
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${rows.length} workers…`}
          aria-label="Search workers"
          className="input min-h-11 flex-1 sm:min-h-0"
        />
        <button type="button" onClick={() => markAll("PRESENT")} className="btn-ghost min-h-11 py-1.5 text-xs sm:min-h-0">
          All present
        </button>
        <button type="button" onClick={() => markAll("ABSENT")} className="btn-ghost min-h-11 py-1.5 text-xs sm:min-h-0">
          All absent
        </button>
        <button type="button" onClick={() => markAll("NONE")} className="btn-ghost min-h-11 py-1.5 text-xs sm:min-h-0">
          Clear
        </button>
      </div>

      <div className="space-y-4">
        {[...groups.entries()].map(([role, list]) => {
          const shown = list.filter(matches).length;
          return (
            <section key={role} data-group style={{ display: shown ? undefined : "none" }}>
              <div className="mb-1 flex items-center justify-between gap-2 border-b border-stone-200 pb-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {role} <span className="font-normal">· {list.length}</span>
                </h3>
                <button
                  type="button"
                  onClick={(e) => markAll("PRESENT", e.currentTarget.closest("section"))}
                  className="min-h-11 rounded px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 sm:min-h-0 sm:py-1"
                >
                  All {role} present
                </button>
              </div>
              <ul className="divide-y divide-stone-100">
                {list.map((r) => {
                  const open = extraOpen.has(r.id);
                  const initial = r.status ?? (fresh ? "PRESENT" : "NONE");
                  return (
                    <li key={r.id} data-row style={{ display: matches(r) ? undefined : "none" }} className="py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button type="button" onClick={() => toggleExtra(r.id)} className="min-w-0 text-left" title="Tap to add overtime / extra">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-stone-500">
                            ₹{r.dailyWage}/day · <span className="text-brand-700">{open ? "hide extra" : "+ extra"}</span>
                          </div>
                        </button>
                        <div className="flex gap-1">
                          {OPTIONS.map((o) => (
                            <label key={o.value} title={o.title} className="cursor-pointer">
                              <input type="radio" name={`status_${r.id}`} value={o.value} defaultChecked={initial === o.value} className="peer sr-only" />
                              <span
                                className={`flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 sm:h-9 sm:w-9 ${o.on}`}
                              >
                                {o.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {/* kept in the form even when hidden, so saving never loses an existing value */}
                      <div className={open ? "mt-2 flex items-center gap-2" : "hidden"}>
                        <span className="text-xs text-stone-500">Extra / overtime ₹</span>
                        <input name={`ot_${r.id}`} type="number" min="0" defaultValue={r.overtime || ""} placeholder="0" className="input w-32 py-1.5" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-20 z-10 mt-4 lg:static">
        <SubmitButton className="btn-primary min-h-11 w-full shadow-lg sm:w-auto lg:shadow-none">Save attendance</SubmitButton>
      </div>
    </form>
  );
}
