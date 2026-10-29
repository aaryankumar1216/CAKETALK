"""
Unit and integration tests for CakeTalk API and Server Handlers.
Runs inside sandbox directly without network socket requirements.
"""

import unittest
import json
import io
import os
import random
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
        rand_id = random.randint(10000, 99999)
        reg_req = MockRequest("POST", "/api/auth/register", body={
            "name": f"New Patron {rand_id}",
            "email": f"newpatron{rand_id}@example.com",
            "phone": f"98765{rand_id}",
            "pincode": "562106",
            "password": "mypassword123",
            "role": "customer"
        })
        reg_req.do_POST()
        res = reg_req.get_response_json()
        self.assertTrue(res.get("success"))
        self.assertEqual(res["user"]["role"], "customer")
        self.assertEqual(res["user"]["pincode"], "562106")
        self.assertEqual(res["user"]["loyalty_points"], 50)
        print("✓ POST /api/auth/register (New Customer with Delivery Pincode) passed.")

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

    def test_mobile_otp_flow(self):
        # 1. Send OTP
        send_req = MockRequest("POST", "/api/auth/otp/send", body={"phone": "9876543210"})
        send_req.do_POST()
        send_res = send_req.get_response_json()
        self.assertTrue(send_res.get("success"))
        otp_code = send_res.get("otp")
        self.assertEqual(len(otp_code), 6)
        print("✓ POST /api/auth/otp/send passed. Generated OTP:", otp_code)

        # 2. Verify Wrong OTP
        wrong_req = MockRequest("POST", "/api/auth/otp/verify", body={"phone": "9876543210", "otp": "000000"})
        wrong_req.do_POST()
        wrong_res = wrong_req.get_response_json()
        self.assertFalse(wrong_res.get("success", False))
        print("✓ POST /api/auth/otp/verify (Wrong OTP rejected) passed.")

        # 3. Verify Correct OTP & Sign In
        verify_req = MockRequest("POST", "/api/auth/otp/verify", body={"phone": "9876543210", "otp": otp_code})
        verify_req.do_POST()
        verify_res = verify_req.get_response_json()
        self.assertTrue(verify_res.get("success"))
        self.assertEqual(verify_res["user"]["phone"], "9876543210")
        self.assertEqual(verify_res["user"]["role"], "customer")
        print("✓ POST /api/auth/otp/verify (Correct OTP & Sign In) passed for user:", verify_res["user"]["name"])

    def test_delivery_pincodes_and_serviceability(self):
        # 1. Check existing serviceable pincode (Anekal 562106)
        check_req = MockRequest("GET", "/api/pincodes?pincode=562106")
        check_req.do_GET()
        check_res = check_req.get_response_json()
        self.assertTrue(check_res.get("success"))
        self.assertTrue(check_res.get("available"))
        self.assertEqual(check_res.get("pincode"), "562106")
        self.assertIn("Anekal", check_res.get("area_name"))
        print("✓ GET /api/pincodes?pincode=562106 serviceable check passed.")

        # 2. Check unserviceable pincode
        unavail_req = MockRequest("GET", "/api/pincodes?pincode=999999")
        unavail_req.do_GET()
        unavail_res = unavail_req.get_response_json()
        self.assertTrue(unavail_res.get("success"))
        self.assertFalse(unavail_res.get("available"))
        print("✓ GET /api/pincodes?pincode=999999 unserviceable check passed.")

        # 3. Owner adds a new delivery pincode (560001 - MG Road)
        add_req = MockRequest("POST", "/api/admin/pincodes", body={
            "pincode": "560001",
            "area_name": "MG Road & Central Bangalore",
            "city": "Bangalore",
            "estimated_time": "30-40 mins",
            "delivery_fee": 25.0,
            "is_active": 1
        })
        add_req.do_POST()
        add_res = add_req.get_response_json()
        self.assertTrue(add_res.get("success"))
        new_pin_id = add_res.get("id")
        print("✓ POST /api/admin/pincodes owner add new zone passed. ID:", new_pin_id)

        # 4. Check that new pincode is now available
        new_check = MockRequest("GET", "/api/pincodes?pincode=560001")
        new_check.do_GET()
        new_res = new_check.get_response_json()
        self.assertTrue(new_res.get("available"))
        self.assertEqual(new_res.get("delivery_fee"), 25.0)

        # 5. Owner toggles status to Paused
        toggle_req = MockRequest("PUT", f"/api/admin/pincodes/{new_pin_id}/toggle")
        toggle_req.do_PUT()
        toggle_res = toggle_req.get_response_json()
        self.assertTrue(toggle_res.get("success"))
        self.assertEqual(toggle_res.get("is_active"), 0)
        print("✓ PUT /api/admin/pincodes/<id>/toggle owner pause zone passed.")

        # 6. Verify it is now unavailable
        paused_check = MockRequest("GET", "/api/pincodes?pincode=560001")
        paused_check.do_GET()
        paused_res = paused_check.get_response_json()
        self.assertFalse(paused_res.get("available"))

        # 7. Customer registration with deliverable pincode
        unique_email = f"pincode_cust_{random.randint(1000, 9999)}@test.com"
        reg_req = MockRequest("POST", "/api/auth/register", body={
            "name": "Pincode Test User",
            "email": unique_email,
            "phone": f"98{random.randint(10000000, 99999999)}",
            "pincode": "562106",
            "password": "password123",
            "role": "customer"
        })
        reg_req.do_POST()
        reg_res = reg_req.get_response_json()
        self.assertTrue(reg_res.get("success"))
        self.assertEqual(reg_res["user"]["pincode"], "562106")
        print("✓ POST /api/auth/register with verified pincode passed.")

        # 8. Clean up test pincode
        del_req = MockRequest("DELETE", f"/api/admin/pincodes/{new_pin_id}")
        del_req.do_DELETE()
        del_res = del_req.get_response_json()
        self.assertTrue(del_res.get("success"))
        print("✓ DELETE /api/admin/pincodes/<id> cleanup passed.")

    def test_delete_customer(self):
        # 1. Register a temporary customer
        email = f"temp_cust_{random.randint(1000, 9999)}@example.com"
        reg_req = MockRequest("POST", "/api/auth/register", body={
            "name": "Customer To Delete",
            "email": email,
            "phone": f"99{random.randint(10000000, 99999999)}",
            "pincode": "562106",
            "password": "password123",
            "role": "customer"
        })
        reg_req.do_POST()
        reg_res = reg_req.get_response_json()
        self.assertTrue(reg_res.get("success"))
        cust_id = reg_res["user"]["id"]

        # 2. Delete the customer
        del_req = MockRequest("DELETE", f"/api/customers/{cust_id}")
        del_req.do_DELETE()
        del_res = del_req.get_response_json()
        self.assertTrue(del_res.get("success"))
        print("✓ DELETE /api/customers/<id> customer deletion passed.")

        # 3. Verify customer is gone
        del_check = MockRequest("DELETE", f"/api/customers/{cust_id}")
        del_check.do_DELETE()
        self.assertFalse(del_check.get_response_json().get("success", False))

        # 4. Verify cannot delete admin/owner account (ID 1)
        admin_del = MockRequest("DELETE", "/api/customers/1")
        admin_del.do_DELETE()
        admin_res = admin_del.get_response_json()
        self.assertFalse(admin_res.get("success", False))
        print("✓ DELETE /api/customers/<id> protected owner/admin deletion passed.")

if __name__ == "__main__":
    unittest.main()
