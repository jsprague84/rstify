#!/usr/bin/env python3
"""
rstify Production Testing Script
Tests the production instance at https://rstify.js-node.cc
"""

import requests
import json
import time
import sys
from datetime import datetime

BASE_URL = "https://rstify.js-node.cc"

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text):
    print(f"\n{BLUE}{'=' * 60}{RESET}")
    print(f"{BLUE}{text}{RESET}")
    print(f"{BLUE}{'=' * 60}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✓ {text}{RESET}")

def print_error(text):
    print(f"{RED}✗ {text}{RESET}")

def print_info(text):
    print(f"{YELLOW}ℹ {text}{RESET}")

def test_endpoint(method, path, description, expected_status=200, headers=None, data=None):
    """Test a single endpoint and return results"""
    url = f"{BASE_URL}{path}"
    start_time = time.time()

    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=10)
        else:
            response = requests.request(method, url, headers=headers, json=data, timeout=10)

        elapsed = (time.time() - start_time) * 1000  # Convert to ms

        result = {
            "description": description,
            "url": url,
            "method": method,
            "status_code": response.status_code,
            "response_time_ms": round(elapsed, 2),
            "success": response.status_code == expected_status,
            "response_size": len(response.content),
            "headers": dict(response.headers)
        }

        # Try to parse JSON response
        try:
            result["response_json"] = response.json()
        except:
            result["response_text"] = response.text[:200]  # First 200 chars

        return result

    except Exception as e:
        return {
            "description": description,
            "url": url,
            "method": method,
            "error": str(e),
            "success": False
        }

def print_result(result):
    """Print test result"""
    if result.get("success"):
        print_success(f"{result['description']}")
        print(f"  Status: {result['status_code']} | Time: {result['response_time_ms']}ms | Size: {result['response_size']} bytes")
    else:
        print_error(f"{result['description']}")
        if "error" in result:
            print(f"  Error: {result['error']}")
        else:
            print(f"  Status: {result['status_code']} (expected {result.get('expected_status', 200)})")

    if "response_json" in result:
        print(f"  Response: {json.dumps(result['response_json'], indent=2)[:200]}")

def main():
    print_header("rstify Production Testing Report")
    print(f"Testing instance: {BASE_URL}")
    print(f"Test started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    results = []

    # Test 1: Health Check
    print_header("1. Health & Version Checks")

    result = test_endpoint("GET", "/health", "Health endpoint")
    print_result(result)
    results.append(result)

    result = test_endpoint("GET", "/version", "Version endpoint")
    print_result(result)
    results.append(result)

    # Test 2: Public Endpoints
    print_header("2. Public Endpoint Tests")

    result = test_endpoint("GET", "/", "Web UI home page")
    print_result(result)
    results.append(result)

    # Test 3: Authentication
    print_header("3. Authentication Tests")

    result = test_endpoint(
        "POST",
        "/api/auth/login",
        "Login endpoint (invalid credentials)",
        expected_status=401,
        data={"username": "test", "password": "test"}
    )
    print_result(result)
    results.append(result)

    # Test 4: Protected Endpoints (should return 401)
    print_header("4. Protected Endpoint Tests (No Auth)")

    protected_endpoints = [
        ("/api/stats", "Statistics endpoint"),
        ("/api/topics", "Topics list"),
        ("/api/webhooks", "Webhooks list"),
        ("/message", "Gotify messages endpoint"),
        ("/application", "Gotify applications endpoint"),
    ]

    for path, desc in protected_endpoints:
        result = test_endpoint("GET", path, desc, expected_status=401)
        print_result(result)
        results.append(result)

    # Test 5: Performance Tests
    print_header("5. Performance Tests")

    print_info("Testing health endpoint response time (10 requests)...")
    response_times = []

    for i in range(10):
        result = test_endpoint("GET", "/health", f"Health check #{i+1}")
        if "response_time_ms" in result:
            response_times.append(result["response_time_ms"])

    if response_times:
        avg_time = sum(response_times) / len(response_times)
        min_time = min(response_times)
        max_time = max(response_times)

        print(f"\n  Average response time: {avg_time:.2f}ms")
        print(f"  Min: {min_time:.2f}ms | Max: {max_time:.2f}ms")

        if avg_time < 100:
            print_success(f"Excellent response time: {avg_time:.2f}ms < 100ms")
        elif avg_time < 200:
            print_info(f"Good response time: {avg_time:.2f}ms < 200ms")
        else:
            print_error(f"Slow response time: {avg_time:.2f}ms > 200ms")

    # Test 6: Security Headers
    print_header("6. Security Headers Check")

    result = test_endpoint("GET", "/", "Check security headers")
    if "headers" in result:
        security_headers = {
            "Strict-Transport-Security": result["headers"].get("strict-transport-security"),
            "X-Content-Type-Options": result["headers"].get("x-content-type-options"),
            "X-XSS-Protection": result["headers"].get("x-xss-protection"),
            "Content-Security-Policy": result["headers"].get("content-security-policy"),
            "Referrer-Policy": result["headers"].get("referrer-policy"),
        }

        for header, value in security_headers.items():
            if value:
                print_success(f"{header}: {value}")
            else:
                print_error(f"{header}: Missing")

    # Summary
    print_header("Test Summary")

    total_tests = len(results)
    successful_tests = sum(1 for r in results if r.get("success"))
    failed_tests = total_tests - successful_tests

    print(f"Total tests: {total_tests}")
    print_success(f"Passed: {successful_tests}")
    if failed_tests > 0:
        print_error(f"Failed: {failed_tests}")

    # Save results to JSON
    output_file = "/home/jsprague/dev/rstify/production_test_results.json"
    with open(output_file, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "base_url": BASE_URL,
            "summary": {
                "total": total_tests,
                "passed": successful_tests,
                "failed": failed_tests
            },
            "results": results,
            "performance": {
                "avg_response_time_ms": avg_time if response_times else None,
                "min_response_time_ms": min_time if response_times else None,
                "max_response_time_ms": max_time if response_times else None,
            }
        }, f, indent=2)

    print(f"\n{YELLOW}Detailed results saved to: {output_file}{RESET}")

    return 0 if failed_tests == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
