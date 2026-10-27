"""
Unit and integration tests for CakeTalk API and Server Handlers.
Runs inside sandbox directly without network socket requirements.
"""

import unittest
import json
import io
import os
import sqlite3
from database import init_db, get_db_connection, DB_FILE
from server import CakeTalkRequestHandler

class MockSocket:
    def __init__(self, data=b""):
        self.rfile = io.BytesIO(data)
        self.wfile = io.BytesIO()

    def makefile(self, mode, *args, **kwargs):
        if 'r' in mode:
            return self.rfile
        return self.wfile

class MockRequest(CakeTalkRequestHandler):
    def __init__(self, method, path, headers=None, body=None):
        self.command = method
        self.path = path
        self.request_version = "HTTP/1.1"
        self.headers = headers or {}
        self.rfile = io.BytesIO(json.dumps(body).encode('utf-8') if body else b"")
        if body:
            self.headers["Content-Length"] = str(len(json.dumps(body).encode('utf-8')))
        self.wfile = io.BytesIO()

    def end_headers(self):
        pass

    def send_response(self, code, message=None):
        self.response_code = code

    def send_header(self, keyword, value):
        pass

    def get_response_json(self):
        val = self.wfile.getvalue().decode('utf-8')
        try:
            return json.loads(val)
        except Exception:
            return val

class TestCakeTalk(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_get_products(self):
        req = MockRequest("GET", "/api/products")
        req.do_GET()
        res = req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertGreater(len(res.get("products")), 0)
        print("✓ GET /api/products passed. Total items:", len(res["products"]))

    def test_filter_products_by_category(self):
        req = MockRequest("GET", "/api/products?category=Snacks")
        req.do_GET()
        res = req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertGreater(len(res["products"]), 0)
        for p in res["products"]:
            self.assertEqual(p["category"], "Snacks")
        print("✓ GET /api/products?category=Snacks passed. Total snacks:", len(res["products"]))

    def test_get_analytics(self):
        req = MockRequest("GET", "/api/analytics")
        req.do_GET()
        res = req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertIn("total_revenue", res["analytics"])
        self.assertIn("total_orders", res["analytics"])
        print("✓ GET /api/analytics passed. Revenue:", res["analytics"]["total_revenue"])

    def test_create_order(self):
        order_body = {
            "customer_name": "Test Patron",
            "customer_email": "test@caketalk.com",
            "customer_phone": "+91 98765 43210",
            "order_type": "delivery",
            "scheduled_date": "2026-10-10",
            "scheduled_time": "14:00 - 15:00",
            "delivery_address": "100 Bakery Lane, Bangalore",
            "items": [
                {"id": 1, "title": "Veg Puff", "price": 25.0, "quantity": 4}
            ],
            "subtotal": 100.00,
            "discount": 0.0,
            "delivery_fee": 40.00,
            "total_amount": 140.00,
            "payment_method": "UPI / Cash on Delivery"
        }
        req = MockRequest("POST", "/api/orders", body=order_body)
        req.do_POST()
        res = req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertTrue(res["order_number"].startswith("CT-"))
        print("✓ POST /api/orders passed. Generated Order #:", res["order_number"])

        # Test Order Tracking for newly created order
        track_req = MockRequest("GET", f"/api/orders/{res['order_number']}")
        track_req.do_GET()
        track_res = track_req.get_response_json()
        self.assertTrue(track_res.get("success"))
        self.assertEqual(track_res["order"]["customer_name"], "Test Patron")
        print("✓ GET /api/orders/<id> tracking passed.")

        # Test updating order status
        status_req = MockRequest("PUT", f"/api/orders/{res['order_number']}/status", body={"status": "In Baking", "chef_notes": "Baking fresh veg puffs"})
        status_req.do_PUT()
        status_res = status_req.get_response_json()
        self.assertTrue(status_res.get("success"))
        print("✓ PUT /api/orders/<id>/status passed.")

    def test_coupon_validation(self):
        coupon_req = MockRequest("POST", "/api/coupons/validate", body={"code": "SWEET10", "order_amount": 300.00})
        coupon_req.do_POST()
        res = coupon_req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertEqual(res["discount_amount"], 30.00)
        print("✓ POST /api/coupons/validate passed. 10% on ₹300 = ₹30.00")

    def test_inventory(self):
        inv_req = MockRequest("GET", "/api/inventory")
        inv_req.do_GET()
        res = inv_req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertGreater(len(res["inventory"]), 0)
        print("✓ GET /api/inventory passed. Items:", len(res["inventory"]))

    def test_customer_login(self):
        login_req = MockRequest("POST", "/api/auth/login", body={
            "identifier": "customer@caketalk.com",
            "password": "customer123",
            "role": "customer"
        })
        login_req.do_POST()
        res = login_req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertEqual(res["user"]["role"], "customer")
        self.assertEqual(res["user"]["email"], "customer@caketalk.com")
        print("✓ POST /api/auth/login (Customer) passed.")

    def test_owner_login(self):
        login_req = MockRequest("POST", "/api/auth/login", body={
            "identifier": "owner@caketalk.com",
            "password": "owner123",
            "role": "owner"
        })
        login_req.do_POST()
        res = login_req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertIn(res["user"]["role"], ("admin", "owner"))
        self.assertEqual(res["user"]["email"], "owner@caketalk.com")
        print("✓ POST /api/auth/login (Owner) passed.")

    def test_customer_registration(self):
        import random
        rand_id = random.randint(10000, 99999)
        reg_req = MockRequest("POST", "/api/auth/register", body={
            "name": f"New Patron {rand_id}",
            "email": f"newpatron{rand_id}@example.com",
            "phone": f"98765{rand_id}",
            "password": "mypassword123",
            "role": "customer"
        })
        reg_req.do_POST()
        res = reg_req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertEqual(res["user"]["role"], "customer")
        self.assertEqual(res["user"]["loyalty_points"], 50)
        print("✓ POST /api/auth/register (New Customer) passed.")

    def test_owner_role_restriction(self):
        # Customer trying to authenticate into owner suite
        bad_req = MockRequest("POST", "/api/auth/login", body={
            "identifier": "customer@caketalk.com",
            "password": "customer123",
            "role": "owner"
        })
        bad_req.do_POST()
        res = bad_req.get_response_json()
        self.assertFalse(res.get("success", False))
        self.assertIn("Access Denied", res.get("error", ""))
        print("✓ Role restriction passed (Customer denied on Owner portal).")

    def test_update_single_product_image(self):
        test_img = "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80"
        req = MockRequest("PUT", "/api/products/1/image", body={"image_url": test_img})
        req.do_PUT()
        res = req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("image_url"), test_img)

        # Verify in DB
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT image_url FROM products WHERE id = 1")
        row = c.fetchone()
        self.assertEqual(row["image_url"], test_img)
        print("✓ PUT /api/products/1/image single photo update passed.")

    def test_batch_update_product_images(self):
        img1 = "https://images.unsplash.com/photo-test-1.jpg"
        img2 = "https://images.unsplash.com/photo-test-2.jpg"
        req = MockRequest("PUT", "/api/products/batch-images", body={
            "updates": [
                {"id": 1, "image_url": img1},
                {"id": 2, "image_url": img2}
            ]
        })
        req.do_PUT()
        res = req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("updated_count"), 2)

        # Verify both in DB
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT id, image_url FROM products WHERE id IN (1, 2) ORDER BY id ASC")
        rows = c.fetchall()
        self.assertEqual(rows[0]["image_url"], img1)
        self.assertEqual(rows[1]["image_url"], img2)
        print("✓ PUT /api/products/batch-images multi-product image studio update passed.")

if __name__ == "__main__":
    unittest.main()
