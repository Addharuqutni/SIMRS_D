# Registers Windows scheduled task "SIMRS-Backup": runs scripts/backup.ps1 daily at 02:00.
# Usage: npm run db:backup:schedule   (or run this file directly in PowerShell)
# Note: creating a task for the current user usually needs no admin rights; /F silently
# overwrites the task if it already exists.
$taskName = "SIMRS-Backup"
$backupScript = Join-Path $PSScriptRoot "backup.ps1"

if (-not (Test-Path $backupScript)) {
    Write-Error "backup.ps1 not found at $backupScript"
    exit 1
}

$taskRun = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""

schtasks /Create /F /TN $taskName /SC DAILY /ST 02:00 /TR $taskRun

if ($LASTEXITCODE -eq 0) {
    Write-Host "Scheduled task '$taskName' created (daily 02:00) -> $backupScript"
} else {
    Write-Error "schtasks failed (exit $LASTEXITCODE). Try running PowerShell as Administrator."
    exit $LASTEXITCODE
}
