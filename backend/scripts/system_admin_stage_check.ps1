param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

Write-Host "== System Admin Stage Check ==" -ForegroundColor Cyan

python.exe manage.py system_admin_preflight --strict
python.exe manage.py system_admin_access_check --strict
python.exe manage.py system_admin_query_benchmark --strict --page-size 25
python.exe manage.py system_admin_ops_snapshot --hours 24 --top 10

if (-not $SkipTests) {
    python.exe manage.py test apps.system_admin --keepdb
} else {
    Write-Host "Skipping system_admin test suite (--SkipTests)." -ForegroundColor Yellow
}

Write-Host "System admin stage checks completed." -ForegroundColor Green
