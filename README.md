# Site Manager – Construction Project Management

A Next.js app to track a construction site: labour attendance & daily payments, advances,
raw materials (sariya, cement, bricks…), other expenses, funds invested and the overall budget.

## Run it

```bash
npm install        # installs packages
npm run setup      # creates the local database (prisma/dev.db)
npm run dev        # open http://localhost:3000
```

Optional: `npm run seed` adds a demo site with sample data to explore.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Total invested vs budget, labour/material/other split, pending dues, funds in hand, monthly chart |
| Calendar | Month view – workers present per day and money spent (L/M/E). Click a day to mark attendance |
| Attendance | Mark P / ½ / A for every worker for a day, add extra/overtime, pay workers |
| Workers | Daily wage, days worked, earned, paid, balance (due or advance) |
| Worker page | Personal attendance calendar, payment history, pay / edit |
| Labour Payments | Daily wage / advance / settlement via Cash, GPay/UPI, Bank – filter by month & mode |
| Materials | Purchases with qty × rate, supplier, part-payments and supplier dues |
| Other Expenses | Transport, JCB, electricity, permits, etc. |
| Funds / Investment | Money put into the project (self, partner, loan) and what's left |
| Sites & Budget | Multiple sites, each with its own budget and data |

**How balances work:** present = full wage, half day = half wage, plus any extra entered.
Balance = earned − paid. Positive = you owe the worker; negative = advance they've taken.

Data is stored in a local SQLite file (`prisma/dev.db`). Back it up by copying that file.
