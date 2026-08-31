#!/usr/bin/env bash
# install.sh — FHIR R4 Platform Linux installer
#
# Usage:
#   sudo bash install.sh                                       # fully interactive
#   sudo bash install.sh --mode server --port 8080
#   sudo bash install.sh --mode client --server-url http://10.0.0.1:8080
#   sudo bash install.sh --mode all --install-dir /opt/fhir --unattended
#
# Flags:
#   --mode       all | server | client  (default: interactive)
#   --install-dir  directory            (default: /opt/fhir-platform)
#   --port         backend port         (default: 8080)
#   --client-port  frontend port        (default: 80)
#   --server-url   http://host:port     (required for client mode)
#   --mongo-uri    connection string    (default: mongodb://localhost:27017/fhirdb)
#   --jwt-secret   base64 secret        (default: auto-generated)
#   --cors-origin  URL                  (default: inferred)
#   --install-mongo  install MongoDB via package manager
#   --unattended   skip confirmations

set -euo pipefail

VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# ── Defaults ──────────────────────────────────────────────────────────────────
MODE=""
INSTALL_DIR="/opt/fhir-platform"
PORT="8080"
CLIENT_PORT="80"
SERVER_URL=""
MONGO_URI="mongodb://localhost:27017/fhirdb"
JWT_SECRET=""
CORS_ORIGIN=""
SYNTHEA_HEAP_SIZE=""
INSTALL_MONGO=false
UNATTENDED=false

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)          MODE="$2"; shift 2 ;;
        --install-dir)   INSTALL_DIR="$2"; shift 2 ;;
        --port)          PORT="$2"; shift 2 ;;
        --client-port)   CLIENT_PORT="$2"; shift 2 ;;
        --server-url)    SERVER_URL="$2"; shift 2 ;;
        --mongo-uri)     MONGO_URI="$2"; shift 2 ;;
        --jwt-secret)    JWT_SECRET="$2"; shift 2 ;;
        --cors-origin)   CORS_ORIGIN="$2"; shift 2 ;;
        --synthea-heap-size) SYNTHEA_HEAP_SIZE="$2"; shift 2 ;;
        --install-mongo) INSTALL_MONGO=true; shift ;;
        --unattended)    UNATTENDED=true; shift ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

header()  { echo ""; echo -e "${CYAN}  ── $1 ──${NC}"; }
ok()      { echo -e "${GREEN}  ✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail()    { echo -e "${RED}  ✗ $1${NC}"; exit 1; }

prompt() {
    local label="$1" default="${2:-}"
    if $UNATTENDED && [[ -n "$default" ]]; then echo "$default"; return; fi
    local display="$label"; [[ -n "$default" ]] && display="$label [$default]"
    read -rp "  $display: " val
    echo "${val:-$default}"
}

fill_template() {
    local file="$1"; shift
    local content; content=$(cat "$file")
    while [[ $# -ge 2 ]]; do
        content="${content//\{\{$1\}\}/$2}"
        shift 2
    done
    echo "$content"
}

generate_secret() {
    openssl rand -base64 32 2>/dev/null || python3 -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
}

detect_pkg_manager() {
    if command -v apt-get &>/dev/null; then echo "apt"
    elif command -v dnf &>/dev/null; then echo "dnf"
    elif command -v yum &>/dev/null; then echo "yum"
    else fail "Unsupported package manager. Install Java 17+ and nginx manually."; fi
}

require_java() {
    if command -v java &>/dev/null; then
        local ver; ver=$(java -version 2>&1 | awk -F '"' '/version/{print $2}' | cut -d. -f1)
        if [[ "$ver" -ge 17 ]]; then ok "Java $ver found."; return; fi
    fi
    warn "Java 17+ not found. Installing..."
    local pm; pm=$(detect_pkg_manager)
    case "$pm" in
        apt) apt-get install -y temurin-21-jdk 2>/dev/null || apt-get install -y openjdk-21-jre-headless ;;
        dnf|yum) $pm install -y java-21-openjdk-headless ;;
    esac
    ok "Java installed."
}

require_nginx() {
    if ! command -v nginx &>/dev/null; then
        warn "nginx not found. Installing..."
        local pm; pm=$(detect_pkg_manager)
        case "$pm" in
            apt) apt-get install -y nginx ;;
            dnf|yum) $pm install -y nginx ;;
        esac
    fi
    ok "nginx found."
}

install_mongo_if_requested() {
    if ! $INSTALL_MONGO; then return; fi
    warn "Installing MongoDB..."
    local pm; pm=$(detect_pkg_manager)
    case "$pm" in
        apt)
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
                > /etc/apt/sources.list.d/mongodb-org-7.0.list
            apt-get update -q
            apt-get install -y mongodb-org ;;
        dnf|yum)
            cat > /etc/yum.repos.d/mongodb-org-7.0.repo <<'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
            $pm install -y mongodb-org ;;
    esac
    systemctl enable mongod
    systemctl start mongod
    ok "MongoDB installed and started."
}

write_systemd_unit() {
    local name="$1" exec_start="$2" working_dir="$3"
    cat > "/etc/systemd/system/${name}.service" <<EOF
[Unit]
Description=FHIR R4 Platform — ${name}
After=network.target

[Service]
Type=simple
User=fhir
WorkingDirectory=${working_dir}
ExecStart=${exec_start}
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${name}

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable "$name"
    systemctl restart "$name"
    ok "Systemd unit registered and started: ${name}"
}

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║   FHIR R4 Platform — Linux Installer      ║${NC}"
echo -e "${CYAN}  ║   Version ${VERSION}                            ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════════════╝${NC}"
echo ""

[[ "$EUID" -ne 0 ]] && fail "This installer must be run as root (sudo)."

# ── Mode selection ────────────────────────────────────────────────────────────
header "Installation mode"
if [[ -z "$MODE" ]]; then
    echo "  1. All-in-one   — server + client on this host"
    echo "  2. Server only  — backend + MongoDB (API only)"
    echo "  3. Client only  — admin UI pointing to a remote server"
    choice=$(prompt "Select [1/2/3]" "1")
    case "$choice" in 2) MODE="server" ;; 3) MODE="client" ;; *) MODE="all" ;; esac
fi
ok "Mode: $MODE"

# ── Install directory ─────────────────────────────────────────────────────────
header "Install directory"
INSTALL_DIR=$(prompt "Install directory" "$INSTALL_DIR")
mkdir -p "$INSTALL_DIR/config" "$INSTALL_DIR/logs"

# Create dedicated system user if it doesn't exist
id -u fhir &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin fhir
chown -R fhir:fhir "$INSTALL_DIR"
ok "Directory: $INSTALL_DIR"

# ── SERVER component ──────────────────────────────────────────────────────────
if [[ "$MODE" =~ ^(all|server)$ ]]; then
    header "Server configuration"
    require_java
    install_mongo_if_requested

    PORT=$(prompt "Backend port" "$PORT")
    MONGO_URI=$(prompt "MongoDB URI" "$MONGO_URI")
    if [[ -z "$JWT_SECRET" ]]; then
        JWT_SECRET=$(generate_secret)
        warn "JWT secret auto-generated (save it — it is not shown again)."
    fi
    SYNTHEA_JAR="$INSTALL_DIR/synthea-with-dependencies.jar"
    SYNTHEA_OUT="$INSTALL_DIR/synthea-output"
    mkdir -p "$SYNTHEA_OUT"
    [[ -z "$SYNTHEA_HEAP_SIZE" ]] && SYNTHEA_HEAP_SIZE=$(prompt "Synthea subprocess max heap (-Xmx)" "1024m")
    [[ -z "$CORS_ORIGIN" ]] && CORS_ORIGIN=$(prompt "CORS allowed origin" "http://localhost:$CLIENT_PORT")

    # Write application.yaml from template
    fill_template "$REPO_ROOT/config/application.yaml.template" \
        SERVER_PORT       "$PORT" \
        MONGO_URI         "$MONGO_URI" \
        JWT_SECRET        "$JWT_SECRET" \
        SYNTHEA_JAR_PATH  "$SYNTHEA_JAR" \
        SYNTHEA_OUTPUT_DIR "$SYNTHEA_OUT" \
        SYNTHEA_HEAP_SIZE "$SYNTHEA_HEAP_SIZE" \
        CORS_ORIGIN       "$CORS_ORIGIN" \
        > "$INSTALL_DIR/config/application.yaml"
    chmod 600 "$INSTALL_DIR/config/application.yaml"
    chown fhir "$INSTALL_DIR/config/application.yaml"
    ok "Config written: $INSTALL_DIR/config/application.yaml"

    # Copy JAR
    JAR=$(find "$REPO_ROOT/fhir-server/target" -name "*.jar" ! -name "*sources*" ! -name "*javadoc*" 2>/dev/null | head -1)
    if [[ -n "$JAR" ]]; then
        cp "$JAR" "$INSTALL_DIR/fhir-server.jar"
        chown fhir "$INSTALL_DIR/fhir-server.jar"
        ok "JAR copied: $INSTALL_DIR/fhir-server.jar"
    else
        warn "fhir-server JAR not found. Run 'mvn package' or download the release JAR to $INSTALL_DIR/fhir-server.jar"
    fi

    # Register systemd unit
    write_systemd_unit "fhir-server" \
        "java -jar $INSTALL_DIR/fhir-server.jar --spring.config.location=$INSTALL_DIR/config/application.yaml" \
        "$INSTALL_DIR"
fi

# ── CLIENT component ──────────────────────────────────────────────────────────
if [[ "$MODE" =~ ^(all|client)$ ]]; then
    header "Client (UI) configuration"
    require_nginx

    CLIENT_PORT=$(prompt "UI listen port" "$CLIENT_PORT")
    if [[ "$MODE" == "client" && -z "$SERVER_URL" ]]; then
        SERVER_URL=$(prompt "Backend server URL (e.g. http://10.0.0.1:8080)")
    fi
    [[ "$MODE" == "all" ]] && SERVER_URL="http://localhost:$PORT"

    # Copy UI dist
    UI_TARGET="$INSTALL_DIR/ui"
    UI_DIST="$REPO_ROOT/fhir-admin-ui/dist"
    if [[ -d "$UI_DIST" ]]; then
        cp -r "$UI_DIST" "$UI_TARGET"
        chown -R fhir:fhir "$UI_TARGET"
        ok "UI files copied: $UI_TARGET"
    else
        warn "UI dist not found at $UI_DIST. Run 'npm run build' or extract the release UI archive to $UI_TARGET"
    fi

    # Write nginx config from template
    fill_template "$REPO_ROOT/config/nginx-client.conf.template" \
        CLIENT_PORT     "$CLIENT_PORT" \
        SERVER_NAME     "localhost" \
        INSTALL_DIR     "$INSTALL_DIR" \
        FHIR_SERVER_URL "$SERVER_URL" \
        > "$INSTALL_DIR/config/nginx.conf"
    ok "nginx config written: $INSTALL_DIR/config/nginx.conf"

    # Link into nginx sites
    ln -sf "$INSTALL_DIR/config/nginx.conf" /etc/nginx/sites-enabled/fhir-platform.conf 2>/dev/null || \
        ln -sf "$INSTALL_DIR/config/nginx.conf" /etc/nginx/conf.d/fhir-platform.conf
    nginx -t && systemctl reload nginx
    ok "nginx reloaded."
fi

# ── Summary ───────────────────────────────────────────────────────────────────
header "Installation complete"
[[ "$MODE" =~ ^(all|server)$ ]] && {
    echo "  FHIR API  : http://localhost:${PORT}/fhir/"
    echo "  Auth API  : http://localhost:${PORT}/api/auth/login"
    echo "  Config    : ${INSTALL_DIR}/config/application.yaml"
    echo "  Logs      : journalctl -u fhir-server -f"
    echo ""
    echo "  Default login: admin / admin"
    warn "Set APP_JWT_SECRET before exposing this server beyond localhost."
}
[[ "$MODE" =~ ^(all|client)$ ]] && echo "  Admin UI  : http://localhost:${CLIENT_PORT}"
echo ""
