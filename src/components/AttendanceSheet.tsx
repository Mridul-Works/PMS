"use client";

import { useRef } from "react";
import { saveAttendance } from "@/lib/actions";
import { SubmitButton } from "./buttons";

type Row = { id: number; name: string; role: string; dailyWage: number; status?: string; overtime?: number };

const OPTIONS = [
  { value: "PRESENT", label: "P", title: "Present", on: "peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600" },
  { value: "HALF", label: "½", title: "Half day", on: "peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500" },
  { value: "ABSENT", label: "A", title: "Absent", on: "peer-checked:bg-rose-600 peer-checked:text-white peer-checked:border-rose-600" },
  { value: "NONE", label: "–", title: "Not marked", on: "peer-checked:bg-stone-500 peer-checked:text-white peer-checked:border-stone-500" },
];

export function AttendanceSheet({ date, rows }: { date: string; rows: Row[] }) {
  const formRef = useRef<HTMLFormElement>(null);

  const markAll = (value: string) => {
    formRef.current
      ?.querySelectorAll<HTMLInputElement>(`input[type=radio][value=${value}]`)
      .forEach((el) => (el.checked = true));
  };

  return (
    <form ref={formRef} action={saveAttendance} key={date}>
      <input type="hidden" name="date" value={date} />
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => markAll("PRESENT")} className="btn-ghost py-1.5 text-xs">
          Mark all present
        </button>
        <button type="button" onClick={() => markAll("ABSENT")} className="btn-ghost py-1.5 text-xs">
          Mark all absent
        </button>
        <button type="button" onClick={() => markAll("NONE")} className="btn-ghost py-1.5 text-xs">
          Clear all
        </button>
      </div>
      <div className="-mx-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Status</th>
              <th className="w-32">Extra / OT (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-stone-500">
                    {r.role} · ₹{r.dailyWage}/day
                  </div>
                </td>
                <td>
                  <div className="flex gap-1">
                    {OPTIONS.map((o) => (
                      <label key={o.value} title={o.title} className="cursor-pointer">
                        <input
                          type="radio"
                          name={`status_${r.id}`}
                          value={o.value}
                          defaultChecked={(r.status ?? "NONE") === o.value}
                          className="peer sr-only"
                        />
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 ${o.on}`}
                        >
                          {o.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  <input
                    name={`ot_${r.id}`}
                    type="number"
                    min="0"
                    defaultValue={r.overtime || ""}
                    placeholder="0"
                    className="input py-1.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <SubmitButton>Save attendance</SubmitButton>
      </div>
    </form>
  );
}
