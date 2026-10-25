export const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "GPAY", label: "Google Pay / UPI" },
  { value: "BANK", label: "Bank Transfer" },
] as const;

export const LABOUR_PAYMENT_TYPES = [
  { value: "DAILY", label: "Daily wage" },
  { value: "ADVANCE", label: "Advance" },
  { value: "SETTLEMENT", label: "Settlement / Weekly" },
] as const;

export const ATTENDANCE_STATUS = [
  { value: "PRESENT", label: "Present", short: "P" },
  { value: "HALF", label: "Half day", short: "H" },
  { value: "ABSENT", label: "Absent", short: "A" },
] as const;

export const WORKER_ROLES = [
  "Mistri (Mason)",
  "Labour",
  "Helper",
  "Carpenter",
  "Bar bender",
  "Plumber",
  "Electrician",
  "Painter",
  "Tile fitter",
  "Supervisor",
  "Other",
];

// Common materials with their usual unit
export const MATERIALS: { name: string; unit: string }[] = [
  { name: "Sariya (Steel / TMT)", unit: "kg" },
  { name: "Cement", unit: "bag" },
  { name: "Bricks", unit: "piece" },
  { name: "Sand (Reta)", unit: "trolley" },
  { name: "Gravel (Rodi / Gitti)", unit: "trolley" },
  { name: "Binding wire", unit: "kg" },
  { name: "Tiles", unit: "box" },
  { name: "Marble / Stone", unit: "sq ft" },
  { name: "Paint", unit: "litre" },
  { name: "Plumbing items", unit: "lot" },
  { name: "Electrical items", unit: "lot" },
  { name: "Wood / Shuttering", unit: "lot" },
  { name: "Other", unit: "lot" },
];

export const UNITS = ["kg", "ton", "quintal", "bag", "piece", "trolley", "truck", "cft", "sq ft", "box", "litre", "lot"];

export const EXPENSE_CATEGORIES = [
  "Transport / Freight",
  "Machinery / JCB rent",
  "Electricity",
  "Water / Tanker",
  "Permits / Approvals",
  "Architect / Engineer fees",
  "Tools & Equipment",
  "Food / Tea",
  "Contractor (theka)",
  "Miscellaneous",
];

export function modeLabel(v: string) {
  return PAYMENT_MODES.find((m) => m.value === v)?.label ?? v;
}
export function payTypeLabel(v: string) {
  return LABOUR_PAYMENT_TYPES.find((m) => m.value === v)?.label ?? v;
}
