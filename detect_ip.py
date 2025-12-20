#!/usr/bin/env python3
"""
Script to detect local IP address for development
"""

import socket
import subprocess
import platform
import re

def get_local_ip():
    """Get the local IP address of this machine"""
    try:
        # Create a socket and connect to a public DNS server
        # This will tell us which local IP is being used
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # Google DNS
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception as e:
        print(f"Error detecting IP: {e}")
        return None

def get_windows_ip():
    """Get IP on Windows using ipconfig"""
    try:
        result = subprocess.run(['ipconfig'], capture_output=True, text=True, shell=True)
        # Look for IPv4 addresses in the output
        lines = result.stdout.split('\n')
        for line in lines:
            if 'IPv4 Address' in line:
                ip_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', line)
                if ip_match:
                    ip = ip_match.group(1)
                    # Skip loopback and common virtual IPs
                    if not ip.startswith('127.') and not ip.startswith('169.'):
                        return ip
        return None
    except Exception as e:
        print(f"Error getting Windows IP: {e}")
        return None

def get_unix_ip():
    """Get IP on Unix-like systems using ifconfig or ip"""
    try:
        # Try ip command first (Linux)
        try:
            result = subprocess.run(['ip', 'route', 'get', '8.8.8.8'],
                                  capture_output=True, text=True)
            ip_match = re.search(r'src (\d+\.\d+\.\d+\.\d+)', result.stdout)
            if ip_match:
                return ip_match.group(1)
        except:
            pass

        # Fallback to ifconfig (macOS, older Linux)
        result = subprocess.run(['ifconfig'], capture_output=True, text=True)
        lines = result.stdout.split('\n')

        for i, line in enumerate(lines):
            if 'inet ' in line and '127.0.0.1' not in line:
                ip_match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)', line)
                if ip_match:
                    ip = ip_match.group(1)
                    # Skip loopback and link-local
                    if not ip.startswith('127.') and not ip.startswith('169.'):
                        return ip
        return None
    except Exception as e:
        print(f"Error getting Unix IP: {e}")
        return None

def main():
    print("Detecting local IP address for development...")
    print(f"Platform: {platform.system()}")

    ip = None

    if platform.system() == 'Windows':
        ip = get_windows_ip()
    else:
        ip = get_unix_ip()

    # Fallback to socket method
    if not ip:
        print("⚠️  Platform-specific detection failed, trying socket method...")
        ip = get_local_ip()

    if ip:
        print(f"OK: Detected IP: {ip}")
        print(f"Use this IP in your React Native config:")
        print(f"   Android: http://{ip}:8001")
        print(f"   iOS: http://{ip}:8001")
        print(f"   Physical devices: http://{ip}:8001")
        print(f"")
        print(f"Manual update instructions:")
        print(f"1. Open frontend/config/api.ts")
        print(f"2. Find: '192.168.1.18'")
        print(f"3. Replace with: '{ip}'")
        print(f"4. Restart Expo: expo r -c")

        # Try to update the config file
        config_file = "frontend/config/api.ts"
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Replace the current IP
            old_pattern = r'192\.168\.1\.18'
            new_pattern = ip

            if old_pattern in content:
                content = content.replace(old_pattern, new_pattern)

                with open(config_file, 'w', encoding='utf-8') as f:
                    f.write(content)

                print(f"OK: Auto-updated {config_file}")
            else:
                print(f"WARN: Could not find IP pattern in {config_file}")

        except Exception as e:
            print(f"ERROR: Error updating config file: {e}")

    else:
        print("ERROR: Could not detect IP address")
        print("")
        print("Manual IP detection:")
        print("Windows: Run 'ipconfig' in Command Prompt")
        print("macOS: Run 'ifconfig' in Terminal")
        print("Linux: Run 'ip addr show' in Terminal")
        print("")
        print("Common IP ranges:")
        print("192.168.1.xxx  - Most common")
        print("192.168.0.xxx  - Alternative")
        print("10.0.0.xxx     - Some networks")
        print("172.16-31.xxx  - Corporate networks")

if __name__ == "__main__":
    main()
