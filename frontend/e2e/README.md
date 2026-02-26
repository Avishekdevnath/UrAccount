# Frontend E2E (System Admin)

These Playwright specs cover the first `/system` control-plane flows:

- `system/companies-bootstrap-wizard.spec.ts`
- `system/role-grant-revoke-access.spec.ts`

## Prerequisites

1. Frontend running locally (`http://127.0.0.1:3000` by default).
2. Install Playwright once:

```powershell
cd frontend
npm install
npx playwright install
```

## Run

```powershell
cd frontend
npm run e2e
```

Optional:

```powershell
npm run e2e:headed
npm run e2e:ui
```

## Notes

- Tests use network-route mocks for `/api/v1` so they validate UI behavior deterministically.
- Keep stable selectors via `data-testid` attributes used in system-admin pages/components.
