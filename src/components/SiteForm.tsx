import { saveSite } from "@/lib/actions";
import { toISODate } from "@/lib/format";
import { Field } from "./ui";
import { SubmitButton } from "./buttons";

type Site = { id: number; name: string; location: string | null; budget: number; startDate: Date; notes: string | null };

export function SiteForm({ site }: { site?: Site }) {
  return (
    <form action={saveSite} className="grid gap-3 sm:grid-cols-2">
      {site && <input type="hidden" name="id" value={site.id} />}
      <Field label="Site / project name *">
        <input name="name" required defaultValue={site?.name} placeholder="e.g. House – Sector 21" className="input" />
      </Field>
      <Field label="Location">
        <input name="location" defaultValue={site?.location ?? ""} placeholder="City / address" className="input" />
      </Field>
      <Field label="Total budget (₹)">
        <input name="budget" type="number" min="0" step="1" defaultValue={site?.budget || ""} placeholder="e.g. 2500000" className="input" />
      </Field>
      <Field label="Start date">
        <input name="startDate" type="date" defaultValue={site ? toISODate(site.startDate) : toISODate(new Date())} className="input" />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea name="notes" rows={2} defaultValue={site?.notes ?? ""} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{site ? "Save changes" : "Create site"}</SubmitButton>
      </div>
    </form>
  );
}
