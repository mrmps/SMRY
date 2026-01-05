#!/bin/bash
# One-time Railway setup for SMRY with Clickhouse
# After running this, future deploys are just: git push

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== SMRY Railway Setup ===${NC}"
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    if command -v brew &> /dev/null; then
        brew install railway
    elif command -v npm &> /dev/null; then
        npm install -g @railway/cli
    else
        echo "Please install Railway CLI: https://docs.railway.app/guides/cli"
        exit 1
    fi
fi

# Login if needed
if ! railway whoami &> /dev/null 2>&1; then
    echo "Please login to Railway..."
    railway login
fi

# Link to project if not linked
echo ""
echo -e "${YELLOW}Linking to Railway project...${NC}"
if ! railway status &> /dev/null 2>&1; then
    railway link
fi

# Generate secrets
ANALYTICS_SECRET=$(openssl rand -hex 32)
CLICKHOUSE_PASSWORD=$(openssl rand -hex 16)

echo ""
echo -e "${YELLOW}Adding Clickhouse service...${NC}"

# Add Clickhouse service with Docker image
railway add \
    --service clickhouse \
    --image clickhouse/clickhouse-server:24.8 \
    --variables "CLICKHOUSE_DB=smry_analytics" \
    --variables "CLICKHOUSE_USER=default" \
    --variables "CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD" \
    --variables "CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1" \
    2>/dev/null || echo "Clickhouse service may already exist, continuing..."

# Add persistent volume
echo "Adding persistent storage..."
railway service link clickhouse 2>/dev/null || true
railway volume add --mount-path /var/lib/clickhouse 2>/dev/null || echo "Volume may already exist"

# Link back to main app service
echo ""
echo -e "${YELLOW}Configuring main app...${NC}"
railway service link SMRY 2>/dev/null || railway service link smry 2>/dev/null || true

# Set app variables to connect to Clickhouse
railway variables \
    --set "CLICKHOUSE_URL=http://clickhouse.railway.internal:8123" \
    --set "CLICKHOUSE_USER=default" \
    --set "CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD" \
    --set "CLICKHOUSE_DATABASE=smry_analytics" \
    --set "ANALYTICS_SECRET_KEY=$ANALYTICS_SECRET"

echo ""
echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo "Clickhouse is configured and will auto-migrate on first request."
echo ""
echo -e "Your analytics dashboard secret key:"
echo -e "  ${YELLOW}${ANALYTICS_SECRET}${NC}"
echo ""
echo "Access your dashboard at:"
echo "  https://smry.ai/admin/analytics?key=${ANALYTICS_SECRET}"
echo ""
echo -e "${GREEN}From now on, just 'git push' to deploy!${NC}"
