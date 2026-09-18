#!/bin/bash
# Periodic container up/down probe for OpenObserve.
#
# docker_stats only reports containers that are running, so a container that
# has died emits nothing at all and cannot be charted or alerted on. This walks
# `docker ps -a` instead -- stopped containers included -- and writes an
# explicit up=1/0 per container into the `container_health` stream, which is
# what the dashboard and alerts read.
#
# Run from cron every couple of minutes (see scripts/scanx-container-health.cron).
# Emits metrics only; it writes nothing to the application log streams.

set -uo pipefail

ENV_FILE="${SCANX_ENV_FILE:-/home/octro/scanx/.env}"
[ -f "$ENV_FILE" ] || { echo "container-health: no env file at $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
# Deliberately NOT OO_ENDPOINT: that one is consumed by docker-compose and must
# stay the in-network name (http://openobserve:5080), because the backend
# resolves it from inside a container. This script runs on the host, where
# OpenObserve is reachable on the published port instead.
OO_HOST_ENDPOINT="$(sed -n 's/^OO_HOST_ENDPOINT=//p' "$ENV_FILE")"
OO_ORG="$(sed -n 's/^OO_ORG=//p' "$ENV_FILE")"
OO_AUTH_HEADER="$(sed -n 's/^OO_AUTH_HEADER=//p' "$ENV_FILE")"
OO_ENDPOINT="${OO_HOST_ENDPOINT:-http://localhost:5080}"
OO_ORG="${OO_ORG:-default}"
STREAM="${SCANX_HEALTH_STREAM:-container_health}"

# Which compose projects to watch, comma separated. Scoping by project label
# keeps one-off//dead containers unrelated to the stack out of the dashboard.
# Add more with e.g. SCANX_HEALTH_PROJECTS="scanx,bookstack_production".
PROJECTS="${SCANX_HEALTH_PROJECTS:-scanx}"

[ -n "$OO_AUTH_HEADER" ] || { echo "container-health: OO_AUTH_HEADER missing" >&2; exit 1; }

TS=$(( $(date +%s) * 1000000 ))

# State is one of created/restarting/running/removing/paused/exited/dead.
# Health is starting/healthy/unhealthy, or "none" when the image defines no
# healthcheck (openobserve and otel-collector are distroless and cannot have one).
filters=()
IFS=',' read -ra _projects <<< "$PROJECTS"
for proj in "${_projects[@]}"; do
  proj="$(echo "$proj" | tr -d '[:space:]')"
  [ -n "$proj" ] && filters+=(--filter "label=com.docker.compose.project=$proj")
done

payload=$(docker ps -a "${filters[@]}" --format '{{.Names}}\t{{.State}}\t{{.Status}}' | \
  while IFS=$'\t' read -r name state status; do
    [ -n "$name" ] || continue
    up=0; [ "$state" = "running" ] && up=1
    health=none
    if   [[ "$status" == *"(healthy)"* ]];        then health=healthy
    elif [[ "$status" == *"(unhealthy)"* ]];      then health=unhealthy
    elif [[ "$status" == *"health: starting"* ]]; then health=starting
    fi
    # A container can be running yet failing its own healthcheck; treat that as
    # not-ok so one field answers "is this container actually serving?".
    ok=$up; [ "$health" = "unhealthy" ] && ok=0
    printf '{"_timestamp":%s,"container_name":"%s","state":"%s","up":%s,"health":"%s","ok":%s}\n' \
      "$TS" "$name" "$state" "$up" "$health" "$ok"
  done | paste -sd, -)

[ -n "$payload" ] || { echo "container-health: no containers found" >&2; exit 1; }

code=$(curl -s -o /tmp/container-health-resp.json -w '%{http_code}' \
  -X POST "${OO_ENDPOINT%/}/api/${OO_ORG}/${STREAM}/_json" \
  -H 'Content-Type: application/json' \
  -H "Authorization: $OO_AUTH_HEADER" \
  --max-time 15 \
  -d "[$payload]")

if [ "$code" != "200" ]; then
  echo "container-health: ingest failed HTTP $code $(head -c 200 /tmp/container-health-resp.json 2>/dev/null)" >&2
  exit 1
fi
