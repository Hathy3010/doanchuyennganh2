#!/usr/bin/env python3
"""
Test script to verify IP connectivity for React Native development
"""

import socket
import subprocess
import platform
import sys

def test_connection(ip, port=8001, timeout=5):
    """Test connection to IP:port"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()

        if result == 0:
            return "OK"
        else:
            return f"FAIL (port {port} not open)"
    except Exception as e:
        return f"ERROR: {str(e)}"

def get_common_ips():
    """Get list of common local IPs to test"""
    return [
        "192.168.1.18",   # Current detected
        "192.168.1.1",    # Router
        "192.168.1.100",  # Common DHCP start
        "192.168.0.1",    # Alternative range
        "192.168.0.100",  # Alternative DHCP
        "10.0.0.1",       # 10.x range
        "10.0.0.100",     # 10.x DHCP
        "172.16.0.1",     # 172.x range
        "172.20.10.1",    # iOS hotspot sometimes
        "localhost",      # Localhost
        "127.0.0.1",      # Localhost numeric
    ]

def main():
    print("Testing IP connectivity for React Native development")
    print("=" * 60)

    print("\nTesting common local network IPs:")
    print("-" * 40)

    common_ips = get_common_ips()
    working_ips = []

    for ip in common_ips:
        status = test_connection(ip)
        print("25")
        if status == "OK":
            working_ips.append(ip)

    print("\n" + "=" * 60)
    print("SUMMARY:")
    print(f"Working IPs: {len(working_ips)} found")

    if working_ips:
        print("\nRecommended configurations:")
        for ip in working_ips[:3]:  # Show top 3
            print(f"  iOS: http://{ip}:8001")
            print(f"  Android: http://{ip}:8001 (or 10.0.2.2:8001 for emulator)")

        print("\nUpdate frontend/config/api.ts:")
        print("  Change: '192.168.1.18' to your working IP")
        print("  Then restart: expo r -c")
    else:
        print("\nNo working IPs found!")
        print("Make sure:")
        print("1. Backend server is running: uvicorn main:app --host 0.0.0.0 --port 8001")
        print("2. Firewall allows connections on port 8001")
        print("3. You're on the same network as the server")

if __name__ == "__main__":
    main()
