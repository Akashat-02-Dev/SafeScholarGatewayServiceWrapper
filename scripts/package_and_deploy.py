#!/usr/bin/env python3
"""
Automated Hostinger VPS Deployment Engine using Paramiko
Transfers archive, executes remote commands, and streams deployment output.
"""

import os
import sys
import tarfile
import paramiko
from scp import SCPClient

EXCLUDE_DIRS = {
    '.git', 'node_modules', 'dist', 'venv', 'cdk.out', '.vscode', '.idea'
}
EXCLUDE_FILES = {
    'main.exe', 'dump.rdb', 'safescholar_deploy.tar.gz'
}

def create_archive(output_path="safescholar_deploy.tar.gz"):
    print(f"===> [1/4] Packaging codebase into {output_path}...")
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    def tar_filter(tarinfo):
        name = os.path.basename(tarinfo.name)
        if name in EXCLUDE_DIRS or name in EXCLUDE_FILES:
            return None
        if any(ex in tarinfo.name.split(os.sep) for ex in EXCLUDE_DIRS):
            return None
        return tarinfo

    with tarfile.open(output_path, "w:gz") as tar:
        for item in os.listdir(root_dir):
            if item in EXCLUDE_DIRS or item in EXCLUDE_FILES:
                continue
            item_path = os.path.join(root_dir, item)
            tar.add(item_path, arcname=item, filter=tar_filter)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"[OK] Archive packaged ({size_mb:.2f} MB)")
    return output_path

def deploy_to_vps(ip, user="root", password=None, key_filename=None):
    archive = create_archive()
    
    print(f"\n===> [2/4] Connecting to {user}@{ip} via SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(
            hostname=ip,
            username=user,
            password=password,
            key_filename=key_filename,
            timeout=15,
            look_for_keys=True
        )
        print("[OK] Connected successfully via SSH!")
    except Exception as e:
        print(f"[ERROR] SSH connection failed: {e}")
        if os.path.exists(archive):
            os.remove(archive)
        return False

    try:
        print("\n===> [3/4] Uploading deployment package to /opt/safescholar/...")
        ssh.exec_command("mkdir -p /opt/safescholar")
        
        with SCPClient(ssh.get_transport()) as scp:
            scp.put(archive, "/opt/safescholar/safescholar_deploy.tar.gz")
        print("[OK] Archive transferred successfully.")

        print("\n===> [4/4] Extracting package and launching deployment on Hostinger VPS...")
        commands = [
            "cd /opt/safescholar && tar -xzf safescholar_deploy.tar.gz",
            "chmod +x /opt/safescholar/scripts/*.sh",
            "cd /opt/safescholar && sudo bash scripts/deploy_hostinger.sh"
        ]
        
        cmd_string = " && ".join(commands)
        stdin, stdout, stderr = ssh.exec_command(cmd_string, get_pty=True)
        
        # Stream live output with Windows cp1252 safety
        for line in iter(stdout.readline, ""):
            try:
                sys.stdout.write(line)
                sys.stdout.flush()
            except UnicodeEncodeError:
                safe_line = line.encode("ascii", errors="replace").decode("ascii")
                sys.stdout.write(safe_line)
                sys.stdout.flush()

        exit_status = stdout.channel.recv_exit_status()
        if exit_status == 0:
            print("\n[SUCCESS] Deployment completed successfully on Hostinger VPS!")
            return True
        else:
            print(f"\n[ERROR] Deployment failed with exit code: {exit_status}")
            return False

    finally:
        ssh.close()
        if os.path.exists(archive):
            os.remove(archive)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/package_and_deploy.py <VPS_IP> [ROOT_PASSWORD]")
        sys.exit(1)
        
    vps_ip = sys.argv[1]
    vps_pass = sys.argv[2] if len(sys.argv) > 2 else None
    deploy_to_vps(vps_ip, user="root", password=vps_pass)
