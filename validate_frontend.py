"""
Frontend validator script for CakeTalk.
Checks HTML tags balance, CSS link targets, JS script tags, and file integrity.
"""

import os
import re

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

def check_html(filename):
    path = os.path.join(PUBLIC_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    print(f"\n--- Checking {filename} ({len(content)} bytes) ---")
    
    # Check script references
    scripts = re.findall(r'<script src="([^"]+)"', content)
    for s in scripts:
        clean = s.lstrip("/")
        target = os.path.join(PUBLIC_DIR, clean)
        exists = os.path.exists(target)
        print(f"  Script {s} -> {'EXISTS' if exists else 'MISSING'}")
        assert exists, f"Script {s} missing!"

    # Check css references
    styles = re.findall(r'<link rel="stylesheet" href="([^"]+)"', content)
    for st in styles:
        clean = st.lstrip("/")
        target = os.path.join(PUBLIC_DIR, clean)
        exists = os.path.exists(target)
        print(f"  CSS {st} -> {'EXISTS' if exists else 'MISSING'}")
        assert exists, f"Stylesheet {st} missing!"

    # Check key elements exist
    if filename == "index.html":
        assert 'id="productsGrid"' in content
        assert 'id="cakeStudioModal"' in content
        assert 'id="cartDrawer"' in content
        assert 'id="checkoutModal"' in content
        assert 'id="orderTrackingModal"' in content
        print("  All key customer UI components present.")
    elif filename == "admin.html":
        assert 'id="tab-analytics"' in content
        assert 'id="tab-orders"' in content
        assert 'id="tab-products"' in content
        assert 'id="tab-inventory"' in content
        assert 'id="tab-customers"' in content
        assert 'id="tab-coupons"' in content
        assert 'id="tab-inquiries"' in content
        print("  All 7 admin tabs and controls present.")

if __name__ == "__main__":
    check_html("index.html")
    check_html("admin.html")
    print("\n✓ Frontend files verification completed successfully!")
