# SIMRS Server

Express 4 + Drizzle ORM backend for the SIMRS hospital app.

## Backup database

- Manual backup (dumps to `server/backups/`, keeps newest 7): `npm run db:backup`
- Schedule daily 02:00 backup via Windows Task Scheduler task "SIMRS-Backup": `npm run db:backup:schedule` (re-run to overwrite; remove with `schtasks /Delete /TN SIMRS-Backup /F`)
- Note: `backup.ps1` runs `pg_dump` through WSL — WSL postgres must be running (`wsl -e service postgresql status`), user `postgres`, password `postgres`, database `simrs`.
