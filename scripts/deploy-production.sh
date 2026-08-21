#!/usr/bin/env bash
# deploy-production.sh — runs on the production host via SSH.
# Pulls the latest tagged images and restarts the stack, then health-checks.
#
# Required environment variables (exported by the caller or .env.prod):
#   IMAGE_TAG
#   DOMAIN
#   APP_JWT_SECRET
#   MONGO_INITDB_ROOT_PASSWORD
#   MONGO_APP_PASSWORD

set -euo pipefail

REPO_DIR="${FHIR_DEPLOY_DIR:-/opt/fhir-platform}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml -p fhir-prod"

echo "=== FHIR Platform — Production Deploy ==="
echo "Image tag : ${IMAGE_TAG}"
echo "Directory : ${REPO_DIR}"
echo "Time      : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

cd "$REPO_DIR"

# Pull latest code (compose files, Caddyfile, scripts) from origin
git fetch origin master
git reset --hard origin/master

# Pull new images
echo "[1/4] Pulling images..."
$COMPOSE pull

# Bring the stack up with zero-downtime restart
echo "[2/4] Restarting stack..."
$COMPOSE up -d --remove-orphans

# Wait for the backend health check
echo "[3/4] Waiting for backend to be healthy..."
TIMEOUT=120
ELAPSED=0
until $COMPOSE ps fhir-server | grep -q "healthy"; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
        echo "ERROR: Backend did not become healthy within ${TIMEOUT}s."
        $COMPOSE logs fhir-server --tail 50
        exit 1
    fi
    echo "  Waiting... (${ELAPSED}s)"
done

# Post-deploy endpoint check (-k accepts self-signed cert; bare IPs have no ACME cert)
echo "[4/4] Verifying endpoints..."
FHIR_VERSION=$(curl -sfkL "https://${DOMAIN}/fhir/metadata" | python3 -c "import sys,json; print(json.load(sys.stdin)['fhirVersion'])" 2>/dev/null || echo "")
if [ "$FHIR_VERSION" != "4.0.1" ]; then
    echo "ERROR: /fhir/metadata did not return expected fhirVersion. Got: '${FHIR_VERSION}'"
    exit 1
fi

HTTP_CODE=$(curl -skLo /dev/null -w "%{http_code}" "https://${DOMAIN}" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
    echo "ERROR: Frontend returned HTTP ${HTTP_CODE} (expected 200)"
    exit 1
fi

echo ""
echo "=== Deploy complete ==="
echo "  FHIR API : https://${DOMAIN}/fhir/"
echo "  Admin UI  : https://${DOMAIN}"
echo "  FHIR R4   : ${FHIR_VERSION}"
echo ""
$COMPOSE ps
