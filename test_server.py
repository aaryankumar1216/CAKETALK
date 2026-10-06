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
        req = MockRequest("GET", "/api/products?category=Artisan%20Breads")
        req.do_GET()
        res = req.get_response_json()
        self.assertTrue(res.get("success"))
        for p in res["products"]:
            self.assertEqual(p["category"], "Artisan Breads")
        print("✓ GET /api/products?category=... passed.")

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
            "customer_phone": "+1 555-1234",
            "order_type": "delivery",
            "scheduled_date": "2026-10-10",
            "scheduled_time": "14:00 - 15:00",
            "delivery_address": "100 Sweet St",
            "items": [
                {"id": 1, "title": "Traditional Country Sourdough", "price": 10.50, "quantity": 2}
            ],
            "subtotal": 21.00,
            "discount": 0.0,
            "delivery_fee": 5.00,
            "total_amount": 26.00,
            "payment_method": "Credit Card"
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
        status_req = MockRequest("PUT", f"/api/orders/{res['order_number']}/status", body={"status": "In Baking", "chef_notes": "Proofing in basket"})
        status_req.do_PUT()
        status_res = status_req.get_response_json()
        self.assertTrue(status_res.get("success"))
        print("✓ PUT /api/orders/<id>/status passed.")

    def test_coupon_validation(self):
        coupon_req = MockRequest("POST", "/api/coupons/validate", body={"code": "SWEET10", "order_amount": 50.00})
        coupon_req.do_POST()
        res = coupon_req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertEqual(res["discount_amount"], 5.00)
        print("✓ POST /api/coupons/validate passed. 10% on $50 = $5.00")

    def test_inventory(self):
        inv_req = MockRequest("GET", "/api/inventory")
        inv_req.do_GET()
        res = inv_req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertGreater(len(res["inventory"]), 0)
        print("✓ GET /api/inventory passed. Items:", len(res["inventory"]))

if __name__ == "__main__":
    unittest.main()
