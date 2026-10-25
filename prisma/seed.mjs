// Fills the database with demo data so you can explore the app.
// Run: npm run seed
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const site = await prisma.site.create({
  data: { name: "Demo House – Plot 42", location: "Jaipur", budget: 3500000, startDate: new Date(daysAgo(60)) },
});

const people = [
  ["Ramesh", "Mistri (Mason)", 900], ["Suresh", "Labour", 550], ["Mahesh", "Labour", 550],
  ["Raju", "Helper", 500], ["Kallu", "Bar bender", 750], ["Sita", "Labour", 500],
];
const workers = [];
for (const [name, role, dailyWage] of people)
  workers.push(await prisma.worker.create({ data: { siteId: site.id, name, role, dailyWage, joinedAt: new Date(daysAgo(60)) } }));

for (let i = 45; i >= 1; i--) {
  const date = daysAgo(i);
  if (new Date(date).getDay() === 0) continue; // Sunday off
  for (const w of workers) {
    const r = Math.random();
    const status = r < 0.8 ? "PRESENT" : r < 0.9 ? "HALF" : "ABSENT";
    await prisma.attendance.create({ data: { siteId: site.id, workerId: w.id, date, status } });
    if (status !== "ABSENT" && Math.random() < 0.6)
      await prisma.labourPayment.create({
        data: { siteId: site.id, workerId: w.id, date, amount: status === "HALF" ? w.dailyWage / 2 : w.dailyWage, type: "DAILY", mode: ["CASH", "GPAY", "CASH"][i % 3] },
      });
  }
}
await prisma.labourPayment.create({ data: { siteId: site.id, workerId: workers[0].id, date: daysAgo(3), amount: 5000, type: "ADVANCE", mode: "GPAY", note: "Advance for family function" } });

const mats = [
  ["Sariya (Steel / TMT)", 2500, "kg", 62, "Shree Steel", 40], ["Cement", 200, "bag", 380, "Ambuja Dealer", 35],
  ["Bricks", 15000, "piece", 7.5, "Bhatta – Ram Lal", 30], ["Sand (Reta)", 8, "trolley", 4200, "Local", 25],
  ["Gravel (Rodi / Gitti)", 6, "trolley", 3800, "Local", 20], ["Cement", 150, "bag", 385, "Ambuja Dealer", 10],
  ["Sariya (Steel / TMT)", 1500, "kg", 63, "Shree Steel", 5],
];
for (const [material, quantity, unit, rate, supplier, ago] of mats) {
  const total = quantity * rate;
  await prisma.materialPurchase.create({
    data: { siteId: site.id, date: daysAgo(ago), material, quantity, unit, rate, total, paid: ago < 8 ? total * 0.5 : total, supplier, mode: "BANK" },
  });
}

const exps = [
  ["Machinery / JCB rent", "JCB for foundation digging", 12000, 42], ["Transport / Freight", "Sariya transport", 2500, 40],
  ["Electricity", "Temporary connection", 8000, 38], ["Water / Tanker", "Water tankers (5)", 2500, 20],
  ["Food / Tea", "Tea & snacks for month", 1800, 10], ["Architect / Engineer fees", "Structural drawings", 25000, 55],
];
for (const [category, description, amount, ago] of exps)
  await prisma.expense.create({ data: { siteId: site.id, date: daysAgo(ago), category, description, amount, mode: ago % 2 ? "CASH" : "GPAY" } });

await prisma.investment.create({ data: { siteId: site.id, date: daysAgo(60), source: "Self", amount: 1000000, mode: "BANK" } });
await prisma.investment.create({ data: { siteId: site.id, date: daysAgo(20), source: "Home loan – SBI", amount: 800000, mode: "BANK" } });

console.log(`Demo site "${site.name}" created.`);
await prisma.$disconnect();
