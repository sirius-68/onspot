#!/usr/bin/env bash
# Runs the pgTAP tests in supabase/tests against a throwaway local Postgres + PostGIS.
# Use this when Docker isn't available. With Docker, prefer: supabase start && supabase test db
#
# Needs: PostgreSQL 15+ server binaries, PostGIS and pgTAP installed for that version.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$ROOT/.pgtest"
PORT="${PGTEST_PORT:-54329}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
RUN_AS=()

if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "PostgreSQL server binaries not found. Set PG_BIN=/path/to/postgres/bin" >&2
  exit 1
fi

# initdb refuses to run as root; use the postgres OS user when we are root.
if [[ "$(id -u)" == "0" ]]; then
  RUN_AS=(runuser -u postgres --)
fi

cleanup() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

rm -rf "$WORK"
mkdir -p "$WORK"
[[ ${#RUN_AS[@]} -gt 0 ]] && chown postgres "$WORK"

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" \
  -l "$WORK/server.log" -w start >/dev/null

PSQL=("${RUN_AS[@]}" "$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "create database onspot_test" >/dev/null
"${PSQL[@]}" -d onspot_test -f "$ROOT/scripts/supabase-shim.sql" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -d onspot_test -f "$f" >/dev/null
done
if [[ -f "$ROOT/supabase/seed.sql" ]]; then
  echo "seed: seed.sql"
  "${PSQL[@]}" -d onspot_test -f "$ROOT/supabase/seed.sql" >/dev/null
fi

status=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  out="$("${PSQL[@]}" -d onspot_test -t -A -f "$t" 2>&1)" || status=1
  planned="$(grep -Eo '^1\.\.[0-9]+' <<<"$out" | head -1 | cut -d. -f3)"
  passed="$(grep -Ec '^ok ' <<<"$out" || true)"
  if grep -Eq '^not ok|^# Looks like|ERROR' <<<"$out" || [[ "$passed" != "$planned" ]]; then
    echo "FAIL $(basename "$t") ($passed/$planned)"
    grep -E '^not ok|^#|ERROR' <<<"$out" | sed 's/^/    /'
    status=1
  else
    echo "ok   $(basename "$t") ($passed/$planned)"
  fi
done

exit $status
