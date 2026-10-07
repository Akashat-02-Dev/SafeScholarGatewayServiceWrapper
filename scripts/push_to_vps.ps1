<#
.SYNOPSIS
    Transfers SafeScholar to your Hostinger VPS and triggers automated deployment.
.PARAMETER VpsIp
    The Public IP address of your Hostinger VPS.
.PARAMETER VpsUser
    The SSH user on the Hostinger VPS (defaults to 'root').
.EXAMPLE
    .\scripts\push_to_vps.ps1 -VpsIp "195.35.x.x"
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$VpsIp,

    [Parameter(Mandatory=$false)]
    [string]$VpsUser = "root"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SafeScholar Hostinger VPS Deployment Packager          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check if .env.hostinger exists
if (-not (Test-Path ".env.hostinger")) {
    Write-Host "[ERROR] .env.hostinger not found! Please create and configure it first." -ForegroundColor Red
    exit 1
}

# 2. Package codebase into a clean archive (excluding node_modules, cache, venv, binaries)
$archiveName = "safescholar_deploy.tar.gz"
Write-Host "===> Packaging codebase into $archiveName (excluding build artifacts)..." -ForegroundColor Yellow

$excludeList = @(
    "--exclude=.git",
    "--exclude=node_modules",
    "--exclude=**/node_modules",
    "--exclude=dist",
    "--exclude=**/dist",
    "--exclude=venv",
    "--exclude=**/venv",
    "--exclude=cdk.out",
    "--exclude=main.exe",
    "--exclude=dump.rdb"
)

# Use tar (built into modern Windows 10/11)
tar -czf $archiveName $excludeList *

Write-Host "[OK] Archive created ($([Math]::Round((Get-Item $archiveName).Length / 1MB, 2)) MB)." -ForegroundColor Green

# 3. Upload archive to Hostinger VPS
Write-Host "===> Uploading $archiveName to $VpsUser@$VpsIp:/opt/safescholar/..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "$VpsUser@$VpsIp" "mkdir -p /opt/safescholar"
scp -o StrictHostKeyChecking=no $archiveName "$VpsUser@$VpsIp:/opt/safescholar/"

# 4. Extract archive on VPS
Write-Host "===> Extracting files on VPS..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "$VpsUser@$VpsIp" "cd /opt/safescholar && tar -xzf $archiveName && chmod +x scripts/*.sh"

# 5. Prompt to run deployment
Write-Host "`n[SUCCESS] Codebase synchronized to $VpsUser@$VpsIp:/opt/safescholar/!" -ForegroundColor Green
Write-Host "`nTo start the deployment now, execute:" -ForegroundColor Cyan
Write-Host "ssh $VpsUser@$VpsIp 'cd /opt/safescholar && sudo bash scripts/deploy_hostinger.sh'" -ForegroundColor White

Remove-Item -Force $archiveName
