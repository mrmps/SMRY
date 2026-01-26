#!/bin/bash
# Analyze source effectiveness via the admin API
# Usage: ADMIN_SECRET=your-secret API_URL=https://your-api.com ./scripts/analyze-sources-api.sh

API_URL="${API_URL:-http://localhost:3001}"
ADMIN_SECRET="${ADMIN_SECRET:-}"

if [ -z "$ADMIN_SECRET" ]; then
  echo "Error: ADMIN_SECRET environment variable is required"
  echo "Usage: ADMIN_SECRET=your-secret API_URL=https://api.smry.ai ./scripts/analyze-sources-api.sh"
  exit 1
fi

echo "=== Fetching admin analytics from $API_URL ==="

curl -s "$API_URL/api/admin?range=7d" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  | jq '
{
  "Overall Health": .health,

  "Source Effectiveness (top 20 hostnames)": [
    .sourceEffectiveness
    | group_by(.hostname)
    | .[]
    | {
        hostname: .[0].hostname,
        sources: [.[] | {source: .source, success_rate: .success_rate, count: .request_count}]
      }
  ][:20],

  "Universally Broken Sites (all sources fail)": .universallyBroken,

  "Source Error Rates (latest 15-min buckets)": [
    .sourceErrorRateTimeSeries
    | group_by(.time_bucket)
    | .[-4:][]
    | {
        time: .[0].time_bucket,
        sources: [.[] | {source: .source, error_rate: .error_rate, total: .total_requests}]
      }
  ]
}'
