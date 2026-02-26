# URAccount

URAccount is a multi-tenant accounting SaaS platform focused on real accounting workflows, data integrity, and production-minded engineering standards.

This repository contains:
- `backend`: Django + DRF API for accounting domain logic.
- `frontend`: Next.js (App Router) UI for operators and finance users.
- `Guide`: project plans, execution documents, and technical checklists.

---

## 1. Product Scope

URAccount MVP covers:
- Auth and multi-tenant company isolation.
- RBAC with Owner/Admin/Accountant/Viewer roles.
- Core accounting:
  - Chart of Accounts
  - Journals (`draft -> posted -> void`)
  - Trial Balance and General Ledger
- Sales (AR):
  - Customers
  - Invoices
  - Receipts and allocations
  - AR Aging
- Purchases (AP):
  - Vendors
  - Bills
  - Vendor payments and allocations
  - AP Aging
- Banking:
  - Bank accounts
  - CSV imports
  - Manual matching
  - Reconciliation finalize flow
- Reports:
  - Profit & Loss
  - Balance Sheet
  - Cash Flow
  - Trial Balance
  - General Ledger
  - CSV export support

---

## 2. Tech Stack

### Backend
- Python, Django 5.x, Django REST Framework
- PostgreSQL (Neon-ready via `DATABASE_URL`)
- JWT auth (`SimpleJWT`)
- OpenAPI (`drf-spectacular`)
- Filtering (`django-filter`)
- CORS (`django-cors-headers`)

### Frontend
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS
- Shadcn config scaffold present (`components.json`)

### Runtime/Infra Direction
- Current deployment path: Non-Docker (venv + Gunicorn + Nginx + managed Postgres)
- Managed DB: Neon PostgreSQL
- Redis/Celery: planned for V2

---

## 3. Repository Structure

```text
.
|- backend/
|  |- apps/                  # Domain modules (accounting, sales, purchases, etc.)
|  |- config/                # Django settings/urls/wsgi
|  |- manage.py
|  |- .env.example
|- frontend/
|  |- src/app/               # Next.js app routes
|  |- src/components/        # Shared UI components
|  |- src/lib/               # API client, routing helpers, auth/session helpers
|  |- package.json
|- Guide/
|  |- project_plans/         # Execution plans and delivery checklists
|- README.md
```

---

## 4. Backend Architecture

Main backend apps:
- `users`: auth endpoints (`login`, `refresh`, `me`, `logout`)
- `companies`: tenant/company and membership/invites
- `rbac`: role and permission assignment/access
- `accounting`: accounts and core accounting entities
- `journals`: journal entries, posting/void workflows
- `contacts`: customers/vendors
- `sales`: invoices, receipts, AR aging
- `purchases`: bills, vendor payments, AP aging
- `banking`: imports, transactions, matching, reconciliation
- `reports`: P&L, BS, Cash Flow, Trial Balance, General Ledger
- `system_admin`: global control-plane APIs (feature-flagged)
- `audit`, `idempotency`, `common`: cross-cutting concerns

Base API prefix:
- `/api/v1/`

System admin APIs (available only when `SYSTEM_ADMIN_ENABLED=1`):
- `/api/v1/system/health/`
- `/api/v1/system/companies/`
- `/api/v1/system/companies/<company_id>/`
- `/api/v1/system/companies/<company_id>/feature-flags/` (`GET`, `PATCH` by `SUPER_ADMIN`)
- `/api/v1/system/companies/<company_id>/quotas/` (`GET`, `PATCH` by `SUPER_ADMIN`)
- `/api/v1/system/users/`
- `/api/v1/system/users/<user_id>/`
- `/api/v1/system/feature-flags/`

Docs endpoints:
- `/api/v1/schema/`
- `/api/v1/docs/`
- Optional DRF browsable auth UI: `/api-auth/` (when enabled)

---

## 5. Frontend Architecture

Primary route groups:
- Public:
  - `/`
  - `/login`
- App:
  - `/app`
  - `/app/c/[companySlug]/...` for tenant-scoped workflows

Current frontend inventory is documented at:
- `Guide/project_plans/frontend_pages_components_inventory.md`

Shared UI foundation currently includes:
- `frontend/src/app/layout.tsx`
- `frontend/src/components/app-shell.tsx`

---

## 6. Security and Data Integrity Controls

Implemented controls:
- Tenant isolation via company membership checks across modules.
- RBAC enforcement for sensitive actions (create/post/void/manage).
- Idempotency keys required for money-moving and posting endpoints.
- Standardized API error schema:
  - `error.code`
  - `error.message`
  - `error.details`
  - `error.request_id`
- Request ID middleware and structured logging.
- Auth throttling (`auth_login`) and global DRF throttles.
- Financial invariants:
  - Double-entry balancing checks
  - Posted entries immutable
  - Voids handled through reversal workflows

---

## 7. Local Setup

## Prerequisites
- Python 3.10+ (3.12 recommended)
- Node.js 20+ and npm
- PostgreSQL connection (Neon recommended) or local PostgreSQL

## Backend Setup

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\activate
```

Install backend dependencies in your venv (if not already installed):

```powershell
pip install -r requirements.txt
```

Create/verify environment file:

```powershell
copy .env.example .env
```

Set `DATABASE_URL` in `backend/.env` (Neon example pattern):

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

Optional feature flags:

```env
SYSTEM_ADMIN_ENABLED=0
AI_ENABLED=0
SUBSCRIPTION_ENABLED=0
```

Bootstrap first system admin:

```powershell
py manage.py grant_system_role your-email@example.com --role SUPER_ADMIN
```

Bootstrap/update an operator account (idempotent):

```powershell
py manage.py bootstrap_system_operator --email ops-admin@yourco.com --full-name "Ops Admin" --password "StrongPass@123" --role SUPER_ADMIN
```

Run system-admin readiness checks:

```powershell
py manage.py system_admin_preflight --strict
py manage.py system_admin_access_check --strict
py manage.py system_admin_query_benchmark --strict --page-size 25
py manage.py system_admin_ops_snapshot --hours 24 --top 10
```

Or run the bundled stage-check script:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File .\scripts\system_admin_stage_check.ps1 -SkipTests
```

Staging/prod rollout evidence templates:
- `backend/docs/system_admin_staging_signoff.md`
- `backend/docs/system_admin_prod_rollout_log.md`

Run migrations and seed demo data:

```powershell
py manage.py migrate
py manage.py seed_demo_accounts
```

Start backend locally:

```powershell
py manage.py runserver
```

Backend base URL:
- `http://127.0.0.1:8000`

## Frontend Setup

```powershell
cd frontend
npm install
```

Optional env for API base URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
# Master UI toggle for system-admin routes/redirect behavior
NEXT_PUBLIC_SYSTEM_ADMIN_UI=0
# Optional: show system-admin demo account pill on login (local demo only)
NEXT_PUBLIC_SHOW_SYSTEM_ADMIN_DEMO=0
```

Start frontend locally:

```powershell
npm run dev
```

Frontend URL:
- `http://localhost:3000`

---

## 8. Demo Credentials

Generated by:

```powershell
cd backend
py manage.py seed_demo_accounts
```

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@demo.local` | `Demo@12345` |
| Admin | `admin@demo.local` | `Demo@12345` |
| Accountant | `accountant@demo.local` | `Demo@12345` |
| Viewer | `viewer@demo.local` | `Demo@12345` |
| System Admin | `sysadmin@demo.local` | `Demo@12345` |

Demo tenant:
- Company: `Demo Company`
- Slug: `demo-company`

---

## 9. Quality Gates and Test Commands

Backend checks:

```powershell
cd backend
py manage.py check
```

Backend tests (isolated in-memory SQLite):

```powershell
cd backend
$env:DATABASE_URL='sqlite:///:memory:'; .\.venv\Scripts\python.exe manage.py test
```

Frontend checks:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run build
npm run e2e
```

One-shot release gate (from repo root):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release_gate_check.ps1 -SkipBackendTests -SkipFrontendE2E
```

Note:
- Frontend build is configured for memory-safe worker limits in constrained Windows environments.
- Frontend E2E specs are in `frontend/e2e/` (system-admin flows, route-mocked).

---

## 10. Deployment (Current Path: Non-Docker + Neon)

Recommended production topology:
- Managed PostgreSQL on Neon
- Backend service:
  - Python venv
  - Gunicorn
  - systemd unit
- Frontend service:
  - `next build`
  - `next start`
  - systemd unit
- Reverse proxy:
  - Nginx
  - TLS via Let's Encrypt

System admin operations runbook:
- `backend/docs/system_admin_runbook.md`

Minimum server baseline:
- 2 vCPU, 4 GB RAM, 40 GB SSD

Recommended baseline:
- 4 vCPU, 8 GB RAM, 80 GB SSD

---

## 11. Project Status (as of 2026-02-19)

Completed:
- Week 1 to Week 5 functional scope.
- Week 6:
  - Standardized error schema complete.
  - E2E, security, and performance test coverage complete per current checklist.
  - Final gate checks for API error consistency, critical E2E, security, and performance marked complete.

In progress:
- Non-Docker local/prod runbook documentation and fresh-setup verification.
- Final Week 6 closeout in execution plan tracking doc.

Reference:
- `Guide/project_plans/week6_hardening_checklist.md`
- `Guide/project_plans/execution_Plan.md`

---

## 12. Why This Repo Is Hire-Ready

This project demonstrates:
- Domain-heavy backend engineering (accounting invariants, posting lifecycles).
- Multi-tenant SaaS fundamentals (RBAC, tenant isolation, idempotency, auditability).
- Production-minded API design (standardized errors, throttling, docs).
- Full-stack implementation (Next.js UI integrated with typed API client).
- Test-driven hardening on critical business workflows.

---

## 13. Security and Secrets Policy

- Do not commit real credentials.
- Use `.env` files for local secrets.
- Keep `.env.example` sanitized.
- Rotate keys if any secret is accidentally exposed.

---

## 14. License

No license file is currently defined in this repository.
Add a license before external distribution.
