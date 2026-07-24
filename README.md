# KinLedger

KinLedger is a family-loan SaaS application for parents who lend money to their
children and want a private, transparent record. Parents are family
administrators; children receive read-only access to their own account.

## What is included

- Super-user, parent, and child sign-in with secure HTTP-only session cookies
- Server-enforced `SUPER_USER`, `ADMIN`, and `CHILD` permissions
- Public “Become a parent lender” application with approval-required access
- Super-user console for approving or declining parent-lender applications
- A parent portfolio with one ledger per child
- Parent-created child accounts with temporary credentials and read-only access
- Parent-created co-parent accounts with equal family-administrator permissions
- Loan, payment, adjustment, and monthly interest ledger entries
- Positive or negative adjustments, including balance-reducing family gifts
- Parent-only transaction editing and removal with automatic balance recalculation
- Interest rate captured on every applicable ledger line
- Parent-controlled, effective-dated APR changes across a child's entire loan ledger
- Exact day-count interest calculation with duplicate-posting protection
- Working Family Access panel for reviewing read-only child membership
- Working family settings for workspace name and monthly interest-posting day
- Live loan snapshot progress derived from posted loans and payments
- Interactive, database-free demo at `/demo`
- Demo navigation back to the homepage and parent-mode child creation
- CSV ledger export
- Responsive desktop and mobile layouts
- Smooth scrolling that cooperates with Next.js route transitions
- Prisma schema for PostgreSQL
- Eight months of realistic seed history for one parent and three children
- Vercel and Neon-ready configuration

## Stack

- Next.js (React + Node.js)
- TypeScript
- PostgreSQL on Neon
- Prisma ORM
- Vercel

## Local setup

Prerequisites: Node.js 20.9 or newer and pnpm 10.34. The project pins the pnpm
version through the `packageManager` field so Corepack and Vercel use the same
compatible release.

Run every project command from:

```powershell
cd C:\Users\jrebe\Desktop\projects\family-loan
```

The application now lives directly in this folder; there is no second nested
`family-loan` project directory.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and add your Neon connection strings. Use the
   pooled Neon URL for `DATABASE_URL` and the direct URL for `DIRECT_URL`.

3. Create a secure session secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Save the output as `SESSION_SECRET` in `.env`.

4. Create the database tables and load the demo:

   ```bash
   pnpm db:push
   pnpm db:seed
   ```

5. Start the application:

   ```bash
   pnpm dev
   ```

Open `http://localhost:3000`. The visual demo at `/demo` does not require a
database.

## Demo accounts

All seeded accounts use the password `FamilyDemo2026!`.

| Role | Email | Access |
| --- | --- | --- |
| Super user | `super@demo.family` | Parent-lender approval console |
| Parent admin | `james@demo.family` | All family accounts and write actions |
| Child | `olivia@demo.family` | Olivia's ledger, read only |
| Child | `ethan@demo.family` | Ethan's ledger, read only |
| Child | `maya@demo.family` | Maya's ledger, read only |

Change or remove these demo passwords before using real family data.

## Account approval workflow

1. A prospective parent selects **Become a parent lender** and submits their
   family workspace, login information, and preferred monthly interest day.
2. KinLedger creates the family and parent administrator in `PENDING` status.
   Pending or rejected parents cannot establish a login session.
3. A `SUPER_USER` opens `/super-admin` and approves or declines the application.
4. Once approved, the parent can sign in and create child accounts.
5. The parent gives each child their temporary password. A child can see only
   their own ledger and cannot call parent write endpoints.

## Co-parent access

An approved parent can open **Family Access** from the dashboard and select
**Add co-parent**. The parent supplies the co-parent's name, email address, and
a temporary password of at least 12 characters.

Co-parents are family administrators. Either parent can create child accounts,
add, edit, or remove ledger transactions, change APRs, calculate interest, and
manage family settings. Child accounts remain read only. The co-parent signs in
through the normal login page and does not require a second super-user approval
because the family workspace is already approved.

Super-user accounts are not publicly creatable. Provision them through the seed
process or the dedicated production command. Set `SUPER_USER_NAME`,
`SUPER_USER_EMAIL`, and a unique 16+ character `SUPER_USER_PASSWORD`, then run:

```bash
pnpm db:create-super
```

The command refuses to convert an existing parent or child email into a super
user. Re-running it for an existing super user safely updates that account’s
name and password.

## Monthly interest

The family record stores an administrator-selected posting day and every loan
uses its annual percentage rate (APR). Interest accrues daily using:

```text
daily interest = outstanding balance × (APR / 100) ÷ 365
```

The calculation walks the ledger chronologically instead of assuming one
unchanged balance for a whole month:

1. verifies that the signed-in user is a family administrator;
2. verifies that the loan belongs to that administrator's family;
3. starts a new loan’s interest on that loan’s effective date;
4. closes the current balance interval on each payment, gift, adjustment, or
   additional loan date;
5. calculates APR interest for the exact number of days in every interval;
6. applies any parent-created APR change from its effective date forward;
7. records the APR on the new interest ledger row; and
8. refuses a duplicate interest posting for the same account and date.

This means a loan made partway through a month accrues only from its loan date.
A payment made before the monthly posting date reduces the balance used from
the payment date onward, producing the correct partial-month interest.

Parents can use **Change APR** on a child account to set a new rate and effective
date. KinLedger records this as a zero-dollar rate-change ledger event. Earlier
balance intervals retain their historical APR, while all outstanding and future
loan balances for that child use the new APR from the selected date forward.

The **Family Access** control lists every child account and its read-only login
status. **Settings** lets the parent rename the family workspace and choose the
monthly interest-posting day from 1 through 28.

For production automation, connect a Vercel Cron job to the interest endpoint
or a dedicated scheduled route. Keep the posting operation idempotent.

## Corrections and gifts

Parent administrators can edit or remove any ledger line. The server verifies
that the transaction belongs to the signed-in parent’s family before allowing
either action. Child users cannot access these controls or endpoints.

Adjustment signs are preserved:

- a positive adjustment increases the child’s balance;
- a negative adjustment reduces the child’s balance;
- for example, an adjustment of `-500.00` records a $500 family gift.

After an edit or removal, KinLedger recalculates all displayed running balances
from the remaining chronological ledger entries.

## Deploy to Vercel with Neon

1. Create a Neon PostgreSQL project.
2. Import this repository into Vercel.
3. Add `DATABASE_URL`, `DIRECT_URL`, and `SESSION_SECRET` to the Vercel project
   environment variables. Set `NEXT_PUBLIC_APP_URL` to the final Vercel URL so
   social previews resolve correctly.
4. Apply the Prisma schema to the production database:

   ```bash
   pnpm exec prisma db push
   ```

5. Deploy. Vercel runs `pnpm build`, which generates the Prisma client before
   compiling Next.js.

The application uses pooled connections at runtime and a direct connection for
schema operations, matching Neon's recommended connection pattern.

## Main data model

- `Family`: workspace, approval status, review note, and monthly posting preference
- `User`: super user, one or more parent administrators, or a read-only child
- `LoanAccount`: one child loan with its default annual rate
- `LedgerEntry`: dated financial line item for loans, payments, interest,
  adjustments, and effective APR changes

Authorization checks live on the server. Hiding controls in the interface is
only a convenience; child accounts cannot call write endpoints successfully.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start local development |
| `pnpm build` | Generate Prisma Client and build for production |
| `pnpm lint` | Run code-quality checks |
| `pnpm db:push` | Synchronize the Prisma schema |
| `pnpm db:migrate` | Create a development migration |
| `pnpm db:seed` | Replace local data with the Bennett demo |
| `pnpm db:create-super` | Provision or rotate the production super user |

## Brand

The UI follows the requested off-white, forest green, sage, warm gold, silver,
charcoal, slate, and light-gray palette. The parent-to-child coin illustration
is used as the product logo and as the source for the favicon.
