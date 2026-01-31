#!/bin/bash
# Query ClickHouse on Railway without leaving it permanently exposed.
# Usage:
#   ./scripts/chquery.sh "SELECT count() FROM request_events"
#   ./scripts/chquery.sh                  # opens interactive mode (reads from stdin)
#   echo "SELECT 1" | ./scripts/chquery.sh

set -euo pipefail

RAILWAY_CONFIG="$HOME/.railway/config.json"
TOKEN=$(python3 -c "import json; print(json.load(open('$RAILWAY_CONFIG'))['user']['token'])")
GQL="https://backboard.railway.app/graphql/v2"
SERVICE_ID="018ada10-9a36-4cd8-a478-89cb1eee5e6f"
ENV_ID="3de92d8f-e295-490e-b228-ef4bd88306e7"

gql() {
  curl -sf -X POST "$GQL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data-binary "$1"
}

# 1. Create a temporary service domain
RESULT=$(gql "{\"query\":\"mutation { serviceDomainCreate(input: { serviceId: \\\"$SERVICE_ID\\\", environmentId: \\\"$ENV_ID\\\" }) { domain id } }\"}")
DOMAIN=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['serviceDomainCreate']['domain'])")
DOMAIN_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['serviceDomainCreate']['id'])")

if [ -z "$DOMAIN" ]; then
  echo "Failed to create domain" >&2
  exit 1
fi

# 2. Set PORT=8123 so Railway routes to ClickHouse's HTTP interface
gql "{\"query\":\"mutation { variableUpsert(input: { projectId: \\\"3daa34e8-bdc3-4e74-ad0e-bf39091d4640\\\", serviceId: \\\"$SERVICE_ID\\\", environmentId: \\\"$ENV_ID\\\", name: \\\"PORT\\\", value: \\\"8123\\\" }) }\"}" > /dev/null

CH_URL="https://$DOMAIN"
CH_USER="default"
CH_PASS=$(railway service clickhouse > /dev/null 2>&1 && railway variables list --kv 2>/dev/null | grep CLICKHOUSE_PASSWORD | cut -d= -f2)

cleanup() {
  # Delete domain
  gql "{\"query\":\"mutation { serviceDomainDelete(id: \\\"$DOMAIN_ID\\\") }\"}" > /dev/null 2>&1
  # Delete PORT variable
  gql "{\"query\":\"mutation { variableDelete(input: { projectId: \\\"3daa34e8-bdc3-4e74-ad0e-bf39091d4640\\\", serviceId: \\\"$SERVICE_ID\\\", environmentId: \\\"$ENV_ID\\\", name: \\\"PORT\\\" }) }\"}" > /dev/null 2>&1
}
trap cleanup EXIT

# 3. Wait for the domain to become reachable
echo "Waiting for ClickHouse to be reachable..." >&2
for i in $(seq 1 30); do
  if curl -sf --max-time 3 "$CH_URL/ping" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -sf --max-time 3 "$CH_URL/ping" > /dev/null 2>&1; then
  echo "Timed out waiting for ClickHouse" >&2
  exit 1
fi

# 4. Run the query
if [ $# -gt 0 ]; then
  QUERY="$1"
  FORMAT="${2:-PrettyCompact}"
  curl -s "$CH_URL/?user=$CH_USER&password=$CH_PASS&database=smry_analytics" \
    --data-binary "$QUERY FORMAT $FORMAT"
else
  # stdin mode
  if [ -t 0 ]; then
    echo "Enter query (Ctrl+D to send):" >&2
  fi
  QUERY=$(cat)
  curl -s "$CH_URL/?user=$CH_USER&password=$CH_PASS&database=smry_analytics" \
    --data-binary "$QUERY"
fi
