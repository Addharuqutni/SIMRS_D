# Backup SIMRS Postgres (runs inside WSL) to server/backups, keeps last 7.
param([string]$OutDir = "$PSScriptRoot\..\backups")

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# ponytail: password inline; move to env var BACKUP_DB_PASS if this ever leaves the dev machine
$dump = wsl -e sh -c "PGPASSWORD=postgres pg_dump -h localhost -U postgres simrs"
if ($LASTEXITCODE -ne 0 -or -not $dump) {
    Write-Error "pg_dump failed (exit $LASTEXITCODE). Is WSL postgres running?"
    exit 1
}
$dump | Out-File -Encoding utf8 (Join-Path $OutDir "simrs-$ts.sql")

# keep newest 7
Get-ChildItem $OutDir -Filter *.sql |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 7 |
    Remove-Item -ErrorAction SilentlyContinue

Write-Host "Backup OK: simrs-$ts.sql"
Get-ChildItem $OutDir -Filter *.sql | Select-Object Name, Length | Format-Table
