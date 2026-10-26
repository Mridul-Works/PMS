# Site Manager – Construction Project Management

A Next.js app to track a construction site: labour attendance & daily payments, advances,
raw materials (sariya, cement, bricks…), other expenses, funds invested and the overall budget.

## Run it

```bash
npm install        # installs packages
npm run setup      # creates .env (with a random login secret) and the local database
npm run dev        # open http://localhost:3000
```

The first time you open the app it asks you to **create the admin account**. After that everyone logs in
with a username and password. The admin adds other users under *Users & Login*.

Optional: `npm run seed` adds a demo site (with partners Mridul 60% / Vinay 40%) and sample data to explore.

**Partners / investors:** add partners and their agreed share on *Partners & Funds*. Every payment form has a
**Paid by** choice – a partner (paid from their own pocket) or the common project fund. Link each partner to
their login user and “Paid by” is pre-filled with whoever is logged in. The page shows each partner's net
contribution vs their share and who should pay whom to settle up.

**Part payments:** for anything with a fixed total that is paid or received in parts (thekedar contract, supplier bill, client payment), use *Part Payments*. Enter the total, pay an advance in ₹ or % (e.g. 20%), plan the rest with due dates, and mark each installment paid when it happens. Material bills also support part payments with full history.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Total invested vs budget, labour/material/other split, pending dues, funds in hand, monthly chart |
| Calendar | Month view – workers present per day and money spent (L/M/E). Click a day to mark attendance |
| Attendance | Mark P / ½ / A for every worker for a day, add extra/overtime, pay workers |
| Workers | Daily wage, days worked, earned, paid, balance (due or advance) |
| Worker page | Personal attendance calendar, payment history, pay / edit |
| Labour Payments | Daily wage / advance / settlement via Cash, GPay/UPI, Bank – filter by month & mode |
| Part Payments | Fixed total paid or received in parts (₹ or %), planned installments with due dates, overdue alerts |
| Materials | Purchases with qty × rate, supplier, part-payments (₹ or %) with history and supplier dues |
| Other Expenses | Transport, JCB, electricity, permits, etc. |
| Partners & Funds | Partners with agreed share %, money put into the common fund, each partner's contribution and settle-up |
| Users & Login | Admin adds/blocks users and resets passwords; everyone can change their own password |
| Sites & Budget | Multiple sites, each with its own budget and data |

**How balances work:** present = full wage, half day = half wage, plus any extra entered.
Balance = earned − paid. Positive = you owe the worker; negative = advance they've taken.

Data is stored in a local SQLite file (`prisma/dev.db`). Back it up by copying that file.
Keep `.env` private – its `AUTH_SECRET` signs the login sessions (changing it logs everyone out).
