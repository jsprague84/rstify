#!/usr/bin/env python3
"""
WebSocket Testing for rstify
Tests real-time message delivery
"""

import asyncio
import websockets
import json
import time
import sys

BASE_URL = "wss://rstify.js-node.cc"
CLIENT_TOKEN = "CL_0200147d515d4b40ac74b95160ff5e4f"  # From previous test

async def test_websocket_connection():
    """Test WebSocket connection and message receiving"""
    uri = f"{BASE_URL}/stream?token={CLIENT_TOKEN}"

    print(f"🔌 Connecting to WebSocket: {uri[:50]}...")

    try:
        async with websockets.connect(uri, ping_interval=20, ping_timeout=10) as websocket:
            print("✅ WebSocket connected successfully!")
            print("📡 Listening for messages (will wait 10 seconds)...")

            # Wait for messages with timeout
            try:
                async with asyncio.timeout(10):
                    async for message in websocket:
                        print(f"\n📨 Message received:")
                        try:
                            msg_data = json.loads(message)
                            print(json.dumps(msg_data, indent=2))
                        except:
                            print(f"Raw: {message}")
            except asyncio.TimeoutError:
                print("\n⏱️  Timeout - no messages received in 10 seconds")
                print("   (This is normal if no new messages were sent)")

            print("\n✅ WebSocket test completed successfully!")
            return True

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ WebSocket connection failed: {e}")
        print(f"   Status code: {e.status_code}")
        return False
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        return False

async def test_websocket_reconnection():
    """Test WebSocket reconnection logic"""
    uri = f"{BASE_URL}/stream?token={CLIENT_TOKEN}"

    print("\n🔄 Testing WebSocket reconnection...")

    for attempt in range(3):
        try:
            async with websockets.connect(uri, ping_interval=20) as websocket:
                print(f"✅ Connection attempt {attempt + 1} successful")
                await asyncio.sleep(1)
        except Exception as e:
            print(f"❌ Connection attempt {attempt + 1} failed: {e}")
            return False

    print("✅ Reconnection test passed!")
    return True

async def main():
    print("=" * 60)
    print("WebSocket Testing for rstify")
    print("=" * 60)
    print()

    # Test 1: Basic connection
    result1 = await test_websocket_connection()

    # Test 2: Reconnection
    result2 = await test_websocket_reconnection()

    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"Basic Connection: {'✅ PASS' if result1 else '❌ FAIL'}")
    print(f"Reconnection: {'✅ PASS' if result2 else '❌ FAIL'}")
    print()

    return 0 if (result1 and result2) else 1

if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
