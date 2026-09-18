#!/bin/bash
# Weekly logical backup of the ScanX MySQL database.
#
# Installed as a cron job (see scripts/scanx-mysql-backup.cron) that runs every
# Sunday. Writes a gzipped mysqldump into BACKUP_DIR and keeps the newest KEEP
# archives, rotating older ones out.
#
# Run by hand with:  ./scripts/mysql-backup.sh
#
# Every setting can be overridden from the environment, so the cron entry does
# not need editing to change retention or destination.

set -euo pipefail

BACKUP_DIR="${SCANX_BACKUP_DIR:-/var/backups/scanx}"
CONTAINER="${SCANX_MYSQL_CONTAINER:-mysql-scanx-1}"
DATABASE="${SCANX_DB_NAME:-scanx}"
KEEP="${SCANX_BACKUP_KEEP:-8}"

mkdir -p "$BACKUP_DIR"
LOG="$BACKUP_DIR/backup.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [mysql-backup] $*" | tee -a "$LOG"; }

fail() { log "ERROR: $*"; exit 1; }

# ---- preflight -------------------------------------------------------------

command -v docker >/dev/null 2>&1 || fail "docker not found in PATH"

[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ] \
    || fail "container '$CONTAINER' is not running; refusing to write an empty backup"

# Read the root password out of the container's own environment rather than
# duplicating the credential in this script or in the crontab.
PW="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" \
      | sed -n 's/^MYSQL_ROOT_PASSWORD=//p')"
[ -n "$PW" ] || fail "could not read MYSQL_ROOT_PASSWORD from '$CONTAINER'"

# ---- dump ------------------------------------------------------------------

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/${DATABASE}-${TS}.sql.gz"
TMP="${OUT}.partial"

log "starting backup of '$DATABASE' -> $OUT"

# MYSQL_PWD keeps the password off the process command line.
# --single-transaction gives a consistent snapshot without locking writers,
# which matters because agents report continuously.
if ! docker exec -e MYSQL_PWD="$PW" "$CONTAINER" \
        mysqldump -uroot \
            --single-transaction \
            --quick \
            --no-tablespaces \
            --set-gtid-purged=OFF \
            --routines --events --triggers \
            "$DATABASE" 2>>"$LOG" | gzip -c > "$TMP"; then
    rm -f "$TMP"
    fail "mysqldump failed"
fi

# Verify the archive before it is allowed to displace an older one.
gzip -t "$TMP" 2>>"$LOG" || { rm -f "$TMP"; fail "archive failed gzip integrity check"; }

# A dump that is suspiciously small usually means the DB was unreachable.
SIZE=$(stat -c%s "$TMP" 2>/dev/null || stat -f%z "$TMP")
[ "$SIZE" -gt 10240 ] || { rm -f "$TMP"; fail "archive is only ${SIZE} bytes; treating as failed"; }

mv "$TMP" "$OUT"
log "wrote $(du -h "$OUT" | cut -f1)"

# ---- rotation --------------------------------------------------------------

ROTATED=0
while IFS= read -r old; do
    [ -n "$old" ] || continue
    rm -f "$old"
    log "rotated out $(basename "$old")"
    ROTATED=$((ROTATED + 1))
done < <(ls -1t "$BACKUP_DIR"/"${DATABASE}"-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)))

RETAINED=$(ls -1 "$BACKUP_DIR"/"${DATABASE}"-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
log "done: ${RETAINED} archive(s) retained, ${ROTATED} rotated out"
