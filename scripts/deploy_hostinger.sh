#!/usr/bin/env bash
# ==============================================================================
# SafeScholar Hostinger VPS Deployment Script
# Automatically configures Docker, Firewall, Environment, and starts SafeScholar
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}   SafeScholar Platform - Hostinger VPS + Supabase Deployment       ${NC}"
echo -e "${BLUE}====================================================================${NC}"

# 1. Verify root or sudo access
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this script with root privileges or sudo:${NC}"
  echo "  sudo bash scripts/deploy_hostinger.sh"
  exit 1
fi

# 2. Update packages and install prerequisites
echo -e "\n${YELLOW}===> [1/6] Installing OS Prerequisites & Dependencies...${NC}"
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    python3 \
    python3-pip \
    git

# Configure 2GB Swap if not already configured (ensures smooth builds on 1 vCPU / KVM 1)
if [ $(swapon --show | wc -l) -le 1 ]; then
    echo "Creating 2GB swap space for compilation buffer on KVM 1..."
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo -e "${GREEN}[OK] 2GB Swap buffer configured.${NC}"
fi

# 3. Install Docker & Docker Compose if not present
echo -e "\n${YELLOW}===> [2/6] Checking Docker Engine...${NC}"
if ! command -v docker &> /dev/null; then
    echo "Installing official Docker Engine..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}[OK] Docker installed successfully.${NC}"
else
    echo -e "${GREEN}[OK] Docker is already installed: $(docker --version)${NC}"
fi

# 4. Configure Hostinger VPS Firewall (UFW)
echo -e "\n${YELLOW}===> [3/6] Configuring Hostinger VPS Firewall (UFW)...${NC}"
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (SafeScholar UI & API)'
ufw allow 443/tcp comment 'HTTPS (SSL)'
ufw --force enable
echo -e "${GREEN}[OK] Firewall configured: Ports 22, 80, 443 active.${NC}"

# 5. Check Environment Configuration
echo -e "\n${YELLOW}===> [4/6] Verifying Environment Configuration...${NC}"
ENV_FILE=".env.hostinger"
if [ ! -f "$ENV_FILE" ]; then
    if [ -f ".env" ]; then
        ENV_FILE=".env"
    else
        echo -e "${RED}[ERROR] Neither .env.hostinger nor .env was found!${NC}"
        echo "Please copy .env.hostinger with your Supabase credentials before running deploy."
        exit 1
    fi
fi

# Verify Supabase Postgres string is configured
if grep -v '^[[:space:]]*#' "$ENV_FILE" | grep -q "\[PROJECT-REF\]"; then
    echo -e "${RED}[ERROR] Please update $ENV_FILE with your actual Supabase connection string and password!${NC}"
    echo "Replace [PROJECT-REF], [YOUR-PASSWORD], and [REGION] with your actual Supabase values."
    exit 1
fi
echo -e "${GREEN}[OK] Environment file found and verified: $ENV_FILE${NC}"

# 6. Test Supabase Connectivity
echo -e "\n${YELLOW}===> [5/6] Testing Supabase Connection from VPS...${NC}"
python3 scripts/test_supabase.py "$(grep SUPABASE_POSTGRES_CONN_STRING "$ENV_FILE" | cut -d '=' -f2-)" || {
    echo -e "${RED}[ERROR] Supabase connectivity test failed. Please verify credentials/network.${NC}"
    exit 1
}

# 7. Build and Launch Containers
echo -e "\n${YELLOW}===> [6/6] Building and Starting SafeScholar Containers...${NC}"
docker compose -f docker-compose.hostinger.yml --env-file "$ENV_FILE" down --remove-orphans || true
docker compose -f docker-compose.hostinger.yml --env-file "$ENV_FILE" build --parallel
docker compose -f docker-compose.hostinger.yml --env-file "$ENV_FILE" up -d

echo -e "\n${YELLOW}Waiting for services to become healthy...${NC}"
sleep 10

# 8. Verification & Health Checks
echo -e "\n${BLUE}====================================================================${NC}"
echo -e "${GREEN}   Deployment Complete! Checking Service Status:                    ${NC}"
echo -e "${BLUE}====================================================================${NC}"
docker compose -f docker-compose.hostinger.yml ps

echo -e "\n${YELLOW}Gateway Health Status:${NC}"
curl -s http://localhost/healthz || curl -s http://localhost:8080/healthz || echo "Starting up..."

echo -e "\n\n${GREEN}Access your SafeScholar instance at:${NC} http://$(curl -s ifconfig.me || echo 'YOUR_VPS_IP')/"
echo -e "Super Admin: $(grep SYS_ADMIN_EMAIL "$ENV_FILE" | cut -d '=' -f2-)"
echo -e "To view logs: docker compose -f docker-compose.hostinger.yml logs -f"
