param(
    [switch]$SkipBackendTests,
    [switch]$SkipFrontendE2E
)

$ErrorActionPreference = "Stop"

Write-Host "== UrAccount Release Gate Check ==" -ForegroundColor Cyan

Push-Location backend
try {
    python.exe manage.py system_admin_preflight --strict
    python.exe manage.py system_admin_access_check --strict
    python.exe manage.py system_admin_query_benchmark --strict --page-size 25
    python.exe manage.py system_admin_ops_snapshot --hours 24 --top 10

    if (-not $SkipBackendTests) {
        python.exe manage.py test apps.system_admin --keepdb
    } else {
        Write-Host "Skipping backend test suite (--SkipBackendTests)." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}

Push-Location frontend
try {
    npm.cmd run lint
    npm.cmd run typecheck
    npm.cmd run build

    if (-not $SkipFrontendE2E) {
        npm.cmd run e2e
    } else {
        Write-Host "Skipping frontend E2E suite (--SkipFrontendE2E)." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}

Write-Host "Release-gate checks completed successfully." -ForegroundColor Green
