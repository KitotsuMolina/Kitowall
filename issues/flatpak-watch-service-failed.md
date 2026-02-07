# Issue: `kitowall-watch.service` failed in Flatpak installs

## Symptom

The UI shows:

- `Unit failed: kitowall-watch.service`
- `Unit not active: kitowall-watch.service`

`journalctl --user -u kitowall-watch.service` shows errors like:

- `Unable to locate executable '/app/bin/node'`
- `status=203/EXEC`

## Root Cause

If `Repair` (or `init`) is executed from inside the Flatpak UI, systemd user units can be generated with:

- `ExecStart=/app/bin/node ...`

That path only exists inside Flatpak sandbox, not in the host user systemd context.

## Quick Diagnosis

```bash
systemctl --user cat kitowall-watch.service
journalctl --user -u kitowall-watch.service -n 80 --no-pager
```

If `ExecStart` contains `/app/bin/node`, this issue applies.

## Fix (Host-side regeneration)

Run from host shell, not from inside Flatpak:

```bash
cd /home/kitotsu/Programacion/Personal/Wallpaper/Kitowall

npm run build
node dist/cli.js init --namespace kitowall --apply --force
node dist/cli.js install-systemd --every 10m

systemctl --user daemon-reload
systemctl --user reset-failed
systemctl --user restart kitowall-watch.service
systemctl --user restart swww-daemon@kitowall.service
systemctl --user restart kitowall-next.timer

node dist/cli.js check --json
```

## Expected Result

- `kitowall-watch.service` becomes active.
- `check --json` no longer reports watch unit failed/inactive.
- `systemctl --user cat kitowall-watch.service` shows host node path (for example `/usr/bin/node`) instead of `/app/bin/node`.

## Notes

- Flatpak UI should use host-aware execution paths for repair/init flows.
- If this happens again, regenerate units from host with the commands above.
