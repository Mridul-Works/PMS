type Att = { workerId: number; status: string; overtime: number };
type Pay = { workerId: number; amount: number };
type W = { id: number; dailyWage: number };

export function dayEarning(status: string, wage: number, overtime = 0) {
  const base = status === "PRESENT" ? wage : status === "HALF" ? wage / 2 : 0;
  return base + (overtime || 0);
}

export type WorkerBalance = {
  daysPresent: number;
  halfDays: number;
  earned: number;
  paid: number;
  /** positive = we owe the worker, negative = worker has taken advance */
  balance: number;
};

export function workerBalances(workers: W[], attendance: Att[], payments: Pay[]) {
  const map = new Map<number, WorkerBalance>();
  for (const w of workers) map.set(w.id, { daysPresent: 0, halfDays: 0, earned: 0, paid: 0, balance: 0 });
  const wage = new Map(workers.map((w) => [w.id, w.dailyWage]));
  for (const a of attendance) {
    const b = map.get(a.workerId);
    if (!b) continue;
    if (a.status === "PRESENT") b.daysPresent++;
    if (a.status === "HALF") b.halfDays++;
    b.earned += dayEarning(a.status, wage.get(a.workerId) ?? 0, a.overtime);
  }
  for (const p of payments) {
    const b = map.get(p.workerId);
    if (b) b.paid += p.amount;
  }
  for (const b of map.values()) b.balance = b.earned - b.paid;
  return map;
}
