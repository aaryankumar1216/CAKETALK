"""
CakeTalk Bakery Platform - Full-Stack HTTP & REST API Server
Built with Python 3 standard library (zero external dependencies).
Serves customer frontend, admin management dashboard, and complete REST APIs.
"""

import http.server
import socketserver
import os
import json
import urllib.parse
import mimetypes
import random
import string
import re
from datetime import datetime, timedelta
from database import get_db_connection, init_db, hash_password

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

class CakeTalkRequestHandler(http.server.SimpleHTTPRequestHandler):
    def send_json(self, data, status_code=200):
        """Helper to send JSON response."""
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_json(self, message, status_code=400):
        """Helper to send JSON error response."""
        self.send_json({"error": message, "success": False}, status_code)

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def parse_body(self):
        """Read and parse JSON request body."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                raw_body = self.rfile.read(content_length).decode("utf-8")
                return json.loads(raw_body)
            return {}
        except Exception:
            return {}

    def do_GET(self):
        """Handle GET requests for static files and REST API."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # ------------------- API ROUTES -------------------
        if path.startswith("/api/"):
            conn = get_db_connection()
            cursor = conn.cursor()

            try:
                # 1. Products API
                if path == "/api/products":
                    category = query_params.get("category", [None])[0]
                    dietary = query_params.get("dietary", [None])[0]
                    search = query_params.get("search", [None])[0]
                    sort_by = query_params.get("sort", [None])[0]

                    sql = "SELECT * FROM products WHERE 1=1"
                    params = []

                    if category and category.lower() != "all":
                        sql += " AND category = ?"
                        params.append(category)

                    if dietary and dietary.lower() != "all":
                        sql += " AND dietary_tags LIKE ?"
                        params.append(f"%{dietary}%")

                    if search:
                        sql += " AND (title LIKE ? OR description LIKE ?)"
                        params.extend([f"%{search}%", f"%{search}%"])

                    if sort_by == "price_asc":
                        sql += " ORDER BY price ASC"
                    elif sort_by == "price_desc":
                        sql += " ORDER BY price DESC"
                    elif sort_by == "rating":
                        sql += " ORDER BY rating DESC"
                    else:
                        sql += " ORDER BY is_featured DESC, id ASC"

                    cursor.execute(sql, params)
                    rows = cursor.fetchall()
                    products = [dict(row) for row in rows]
                    self.send_json({"success": True, "products": products})
                    return

                elif path.startswith("/api/products/"):
                    try:
                        product_id = int(path.split("/")[3])
                        cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
                        product = cursor.fetchone()
                        if not product:
                            self.send_error_json("Product not found", 404)
                            return
                        cursor.execute("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC", (product_id,))
                        reviews = [dict(r) for r in cursor.fetchall()]
                        res = dict(product)
                        res["reviews"] = reviews
                        self.send_json({"success": True, "product": res})
                        return
                    except ValueError:
                        self.send_error_json("Invalid product ID", 400)
                        return

                # 2. Orders API
                elif path == "/api/orders":
                    customer_email = query_params.get("email", [None])[0]
                    if customer_email:
                        cursor.execute("SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC", (customer_email,))
                    else:
                        cursor.execute("SELECT * FROM orders ORDER BY created_at DESC")
                    orders = []
                    for row in cursor.fetchall():
                        o = dict(row)
                        try:
                            o["items"] = json.loads(o["items_json"])
                        except Exception:
                            o["items"] = []
                        orders.append(o)
                    self.send_json({"success": True, "orders": orders})
                    return

                elif path.startswith("/api/orders/"):
                    order_num = path.split("/")[3]
                    cursor.execute("SELECT * FROM orders WHERE order_number = ?", (order_num,))
                    order = cursor.fetchone()
                    if not order:
                        self.send_error_json("Order not found", 404)
                        return
                    res = dict(order)
                    try:
                        res["items"] = json.loads(res["items_json"])
                    except Exception:
                        res["items"] = []
                    self.send_json({"success": True, "order": res})
                    return

                # 3. Analytics API
                elif path == "/api/analytics":
                    cursor.execute("SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_revenue, COALESCE(AVG(total_amount), 0) AS avg_order_value FROM orders")
                    stats = dict(cursor.fetchone())

                    cursor.execute("SELECT COUNT(*) AS total_customers FROM users WHERE role = 'customer'")
                    stats["total_customers"] = cursor.fetchone()["total_customers"]

                    # Sales by Category from products
                    cursor.execute("SELECT category, COUNT(*) as count, AVG(price) as avg_price FROM products GROUP BY category")
                    stats["categories"] = [dict(r) for r in cursor.fetchall()]

                    # Low stock alerts count
                    cursor.execute("SELECT COUNT(*) AS low_stock_count FROM inventory WHERE quantity <= min_threshold")
                    stats["low_stock_count"] = cursor.fetchone()["low_stock_count"]

                    # Recent orders
                    cursor.execute("SELECT order_number, customer_name, total_amount, status, scheduled_date, order_type FROM orders ORDER BY created_at DESC LIMIT 5")
                    stats["recent_orders"] = [dict(r) for r in cursor.fetchall()]

                    # Orders status counts
                    cursor.execute("SELECT status, COUNT(*) as count FROM orders GROUP BY status")
                    stats["status_counts"] = {r["status"]: r["count"] for r in cursor.fetchall()}

                    self.send_json({"success": True, "analytics": stats})
                    return

                # 4. Inventory API
                elif path == "/api/inventory":
                    cursor.execute("SELECT * FROM inventory ORDER BY (quantity <= min_threshold) DESC, category ASC")
                    items = [dict(r) for r in cursor.fetchall()]
                    self.send_json({"success": True, "inventory": items})
                    return

                # 5. Reviews API
                elif path == "/api/reviews":
                    product_id = query_params.get("product_id", [None])[0]
                    if product_id:
                        cursor.execute("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC", (product_id,))
                    else:
                        cursor.execute("SELECT r.*, p.title as product_title FROM reviews r LEFT JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC")
                    reviews = [dict(r) for r in cursor.fetchall()]
                    self.send_json({"success": True, "reviews": reviews})
                    return

                # 6. Coupons API
                elif path == "/api/coupons":
                    cursor.execute("SELECT * FROM coupons ORDER BY active DESC, id DESC")
                    coupons = [dict(r) for r in cursor.fetchall()]
                    self.send_json({"success": True, "coupons": coupons})
                    return

                # 7. Inquiries API
                elif path == "/api/inquiries":
                    cursor.execute("SELECT * FROM inquiries ORDER BY created_at DESC")
                    inquiries = [dict(r) for r in cursor.fetchall()]
                    self.send_json({"success": True, "inquiries": inquiries})
                    return

                # 8. Customers Directory API (Admin)
                elif path == "/api/customers":
                    cursor.execute("""
                    SELECT u.id, u.name, u.email, u.phone, u.pincode, u.loyalty_points, u.tier, u.created_at,
                           COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total_spent
                    FROM users u
                    LEFT JOIN orders o ON u.email = o.customer_email
                    WHERE u.role = 'customer'
                    GROUP BY u.id
                    ORDER BY total_spent DESC
                    """)
                    customers = [dict(r) for r in cursor.fetchall()]
                    self.send_json({"success": True, "customers": customers})
                    return

                # 9. Delivery Pincodes API (Customer verification & Owner management)
                elif path == "/api/pincodes":
                    check_pin = query_params.get("pincode", [None])[0]
                    if check_pin:
                        clean_pin = re.sub(r"\D", "", check_pin.strip())
                        cursor.execute("SELECT * FROM delivery_pincodes WHERE pincode = ?", (clean_pin,))
                        row = cursor.fetchone()
                        if row:
                            r = dict(row)
                            if r["is_active"]:
                                fee_text = "Free Delivery" if r["delivery_fee"] == 0 else f"₹{r['delivery_fee']} Delivery"
                                self.send_json({
                                    "success": True,
                                    "available": True,
                                    "pincode": r["pincode"],
                                    "area_name": r["area_name"],
                                    "city": r["city"],
                                    "estimated_time": r["estimated_time"],
                                    "delivery_fee": r["delivery_fee"],
                                    "message": f"✅ Delivery Available: Delivering fresh to {r['area_name']}, {r['city']} in {r['estimated_time']} ({fee_text})!"
                                })
                            else:
                                self.send_json({
                                    "success": True,
                                    "available": False,
                                    "pincode": r["pincode"],
                                    "area_name": r["area_name"],
                                    "city": r["city"],
                                    "message": f"⚠️ Delivery to {r['area_name']} ({r['pincode']}) is temporarily paused by bakery management."
                                })
                        else:
                            self.send_json({
                                "success": True,
                                "available": False,
                                "pincode": clean_pin,
                                "message": f"❌ Sorry! We do not deliver to pincode {clean_pin} yet. Serviceable zones include Anekal, Electronic City, Koramangala, etc."
                            })
                        return

                    # Return all active delivery pincodes
                    cursor.execute("SELECT * FROM delivery_pincodes WHERE is_active = 1 ORDER BY pincode ASC")
                    pincodes = [dict(r) for r in cursor.fetchall()]
                    self.send_json({"success": True, "pincodes": pincodes})
                    return

                # 9b. Admin Delivery Pincodes (all zones, metrics)
                elif path == "/api/admin/pincodes":
                    cursor.execute("SELECT * FROM delivery_pincodes ORDER BY is_active DESC, pincode ASC")
                    pincodes = [dict(r) for r in cursor.fetchall()]
                    active_count = sum(1 for p in pincodes if p["is_active"])
                    free_count = sum(1 for p in pincodes if p["delivery_fee"] == 0 and p["is_active"])
                    self.send_json({
                        "success": True,
                        "pincodes": pincodes,
                        "total": len(pincodes),
                        "active_count": active_count,
                        "free_count": free_count
                    })
                    return

                else:
                    self.send_error_json("Endpoint not found", 404)
                    return

            finally:
                conn.close()

        # ------------------- STATIC FILE SERVING -------------------
        if path == "/" or path == "/index.html":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
        elif path == "/admin" or path == "/admin/":
            self.send_response(302)
            self.send_header("Location", "/#admin")
            self.end_headers()
            return
        elif path == "/login" or path == "/login/":
            self.send_response(302)
            self.send_header("Location", "/#login")
            self.end_headers()
            return
        elif path == "/admin.html":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
        elif path == "/hero-reference.png":
            file_path = os.path.join(BASE_DIR, "Gemini_Generated_Image_453vw2453vw2453v.png")
        else:
            clean_path = path.lstrip("/")
            file_path = os.path.join(PUBLIC_DIR, clean_path)

        if os.path.exists(file_path) and os.path.isfile(file_path):
            self.serve_file(file_path)
        else:
            # Fallback to index.html for SPA-style client routing if not an asset
            if not ("." in os.path.basename(path)):
                fallback_file = os.path.join(PUBLIC_DIR, "index.html")
                if os.path.exists(fallback_file):
                    self.serve_file(fallback_file)
                    return
            self.send_error(404, f"File Not Found: {path}")

    def do_POST(self):
        """Handle POST requests for authentication, ordering, reviews, and admin updates."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self.parse_body()

        if not path.startswith("/api/"):
            self.send_error_json("Invalid API path", 404)
            return

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # 1. Auth: Login (Supports Customer or Owner/Admin by Email or Phone)
            if path == "/api/auth/login":
                identifier = (body.get("email") or body.get("identifier") or body.get("phone") or "").strip()
                password = body.get("password", "")
                role_requested = body.get("role", "").strip().lower() # 'customer' or 'owner'/'admin'

                if not identifier or not password:
                    self.send_error_json("ID/Email/Phone and password are required")
                    return

                hashed = hash_password(password)
                cursor.execute("""
                SELECT id, name, email, role, phone, loyalty_points, tier 
                FROM users 
                WHERE (lower(email) = lower(?) OR phone = ? OR phone = ?) AND password_hash = ?
                """, (identifier, identifier, "+91 " + identifier, hashed))
                user = cursor.fetchone()
                if not user:
                    self.send_error_json("Invalid credentials. Please verify your Email/Phone and password.", 401)
                    return

                user_dict = dict(user)

                # Enforce owner/admin role restriction when logging into owner portal
                if role_requested in ("admin", "owner"):
                    if user_dict.get("role") not in ("admin", "owner"):
                        self.send_error_json("Access Denied: This account is a Customer account. Please log in through the Customer portal.", 403)
                        return

                token = f"ct_token_{user_dict['id']}_{random.randint(100000, 999999)}"
                self.send_json({"success": True, "user": user_dict, "token": token})
                return

            # 1b. Auth: Send Mobile Phone OTP
            elif path == "/api/auth/otp/send":
                raw_phone = str(body.get("phone", "")).strip()
                clean_phone = re.sub(r"\D", "", raw_phone)
                if len(clean_phone) > 10:
                    clean_phone = clean_phone[-10:]

                if len(clean_phone) < 10:
                    self.send_error_json("Please enter a valid 10-digit mobile number")
                    return

                code = str(random.randint(100000, 999999))
                expires_at = (datetime.now() + timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")

                cursor.execute("DELETE FROM otp_codes WHERE phone = ?", (clean_phone,))
                cursor.execute("""
                INSERT INTO otp_codes (phone, code, expires_at)
                VALUES (?, ?, ?)
                """, (clean_phone, code, expires_at))
                conn.commit()

                print(f"[SMS GATEWAY SIMULATOR] Sent OTP {code} to +91 {clean_phone}")
                self.send_json({
                    "success": True,
                    "phone": clean_phone,
                    "otp": code,
                    "message": f"Verification code sent to +91 {clean_phone}.",
                    "expires_in": 300
                })
                return

            # 1c. Auth: Verify Mobile Phone OTP & Sign In
            elif path == "/api/auth/otp/verify":
                raw_phone = str(body.get("phone", "")).strip()
                clean_phone = re.sub(r"\D", "", raw_phone)
                if len(clean_phone) > 10:
                    clean_phone = clean_phone[-10:]

                otp = str(body.get("otp", "")).strip()

                if not clean_phone or not otp:
                    self.send_error_json("Phone number and OTP code are required")
                    return

                cursor.execute("""
                SELECT id, code, expires_at FROM otp_codes 
                WHERE phone = ? AND expires_at > CURRENT_TIMESTAMP 
                ORDER BY id DESC LIMIT 1
                """, (clean_phone,))
                record = cursor.fetchone()

                if not record or record["code"] != otp:
                    self.send_error_json("Invalid or expired OTP. Please enter the correct code or request a new one.")
                    return

                # Delete used OTP
                cursor.execute("DELETE FROM otp_codes WHERE phone = ?", (clean_phone,))

                # Check if customer exists in users table
                cursor.execute("""
                SELECT id, name, email, role, phone, loyalty_points, tier 
                FROM users 
                WHERE phone = ? OR phone = ? OR phone = ?
                """, (clean_phone, "+91 " + clean_phone, "+91" + clean_phone))
                user = cursor.fetchone()

                provided_name = body.get("name", "").strip()

                if not user:
                    # Seamless new customer auto-registration via verified phone + name
                    cust_name = provided_name if provided_name else f"Patron {clean_phone[-4:]}"
                    default_email = f"patron{clean_phone[-4:]}@caketalk.com"
                    default_pw_hash = hash_password("otp_user_" + clean_phone)
                    cursor.execute("""
                    INSERT INTO users (name, email, password_hash, role, phone, loyalty_points, tier)
                    VALUES (?, ?, ?, 'customer', ?, 50, 'Silver Baker')
                    """, (cust_name, default_email, default_pw_hash, clean_phone))
                    conn.commit()
                    user_id = cursor.lastrowid
                    user_dict = {
                        "id": user_id, "name": cust_name, "email": default_email,
                        "role": "customer", "phone": clean_phone, "loyalty_points": 50, "tier": "Silver Baker"
                    }
                else:
                    user_dict = dict(user)
                    if provided_name and user_dict.get("name", "").startswith("Patron "):
                        cursor.execute("UPDATE users SET name = ? WHERE id = ?", (provided_name, user_dict["id"]))
                        conn.commit()
                        user_dict["name"] = provided_name

                conn.commit()
                token = f"ct_token_{user_dict['id']}_{random.randint(100000, 999999)}"
                self.send_json({
                    "success": True,
                    "user": user_dict,
                    "token": token,
                    "message": f"Verified successfully! Welcome, {user_dict['name']}."
                })
                return

            # 2. Auth: Register (Supports New Customer with Phone, Pincode & Email, or Owner/Staff with Security Key)
            elif path == "/api/auth/register":
                name = body.get("name", "").strip()
                email = body.get("email", "").strip().lower()
                phone = body.get("phone", "").strip()
                pincode = body.get("pincode", "").strip()
                password = body.get("password", "")
                role = body.get("role", "customer").strip().lower()
                store_key = body.get("store_key", "").strip()

                if not name or not email or not password:
                    self.send_error_json("Full Name, email, and password are required")
                    return

                if len(password) < 6:
                    self.send_error_json("Password must be at least 6 characters")
                    return

                clean_pincode = None
                if role in ("owner", "admin"):
                    # Validate Owner Master Security Key
                    valid_keys = ("CAKETALK-OWNER-2026", "1216", "owner123", "admin123")
                    if store_key not in valid_keys:
                        self.send_error_json("Invalid Bakery Owner Master Key. Please check the security key or contact management.")
                        return
                    assigned_role = "admin"
                else:
                    assigned_role = "customer"
                    if not phone:
                        self.send_error_json("Phone number is required for customer registration")
                        return

                    # Validate Delivery Pincode for customer
                    clean_pincode = re.sub(r"\D", "", pincode)
                    if not clean_pincode or len(clean_pincode) != 6:
                        self.send_error_json("Please enter a valid 6-digit Indian delivery pincode (e.g. 562106)")
                        return

                    cursor.execute("SELECT area_name, is_active FROM delivery_pincodes WHERE pincode = ?", (clean_pincode,))
                    p_row = cursor.fetchone()
                    if not p_row:
                        self.send_error_json(f"Sorry, we do not deliver to pincode {clean_pincode} yet. Please enter a serviceable pincode (e.g. 562106 for Anekal, 560100 for Electronic City).")
                        return
                    if not p_row["is_active"]:
                        self.send_error_json(f"Delivery to pincode {clean_pincode} ({p_row['area_name']}) is temporarily paused by bakery management.")
                        return

                # Check if email already registered
                cursor.execute("SELECT id FROM users WHERE lower(email) = ?", (email,))
                if cursor.fetchone():
                    self.send_error_json("An account with this email address already exists. Please sign in.")
                    return

                # Check if phone already registered (for customers)
                if phone:
                    cursor.execute("SELECT id FROM users WHERE phone = ? OR phone = ?", (phone, "+91 " + phone))
                    if cursor.fetchone():
                        self.send_error_json("An account with this phone number already exists. Please sign in.")
                        return

                hashed = hash_password(password)
                cursor.execute("""
                INSERT INTO users (name, email, password_hash, role, phone, pincode, loyalty_points, tier)
                VALUES (?, ?, ?, ?, ?, ?, 50, 'Silver Baker')
                """, (name, email, hashed, assigned_role, phone, clean_pincode))
                conn.commit()

                user_id = cursor.lastrowid
                user_dict = {
                    "id": user_id, "name": name, "email": email, "role": assigned_role,
                    "phone": phone, "pincode": clean_pincode, "loyalty_points": 50, "tier": "Silver Baker"
                }
                token = f"ct_token_{user_id}_{random.randint(100000, 999999)}"
                self.send_json({"success": True, "user": user_dict, "token": token, "message": "Account created successfully with 50 Welcome Crumb Points!"})
                return

            # 3. Create Order
            elif path == "/api/orders":
                customer_name = body.get("customer_name", "").strip()
                customer_email = body.get("customer_email", "").strip()
                customer_phone = body.get("customer_phone", "").strip()
                order_type = body.get("order_type", "pickup")
                scheduled_date = body.get("scheduled_date", datetime.now().strftime("%Y-%m-%d"))
                scheduled_time = body.get("scheduled_time", "12:00 - 13:00")
                delivery_address = body.get("delivery_address", "Bakery Pickup Counter")
                items = body.get("items", [])
                subtotal = float(body.get("subtotal", 0.0))
                discount = float(body.get("discount", 0.0))
                delivery_fee = float(body.get("delivery_fee", 0.0))
                total_amount = float(body.get("total_amount", subtotal - discount + delivery_fee))
                payment_method = body.get("payment_method", "Credit Card")
                chef_notes = body.get("chef_notes", "")

                if not customer_name or not customer_email or not items:
                    self.send_error_json("Customer name, email, and order items are required")
                    return

                # Generate clean memorable order number: CT-XXXXX
                rand_digits = "".join(random.choices(string.digits, k=5))
                order_number = f"CT-{rand_digits}"

                cursor.execute("""
                INSERT INTO orders (
                    order_number, customer_name, customer_email, customer_phone,
                    order_type, scheduled_date, scheduled_time, delivery_address,
                    items_json, subtotal, discount, delivery_fee, total_amount,
                    payment_method, payment_status, status, chef_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'Pending', ?)
                """, (
                    order_number, customer_name, customer_email, customer_phone,
                    order_type, scheduled_date, scheduled_time, delivery_address,
                    json.dumps(items), subtotal, discount, delivery_fee, total_amount,
                    payment_method, chef_notes
                ))

                # If user exists, award 1 loyalty point per dollar
                points_earned = int(total_amount)
                cursor.execute("""
                UPDATE users SET loyalty_points = loyalty_points + ? WHERE email = ?
                """, (points_earned, customer_email))

                # Deduct product stock for catalog items
                for it in items:
                    prod_id = it.get("id")
                    qty = it.get("quantity", 1)
                    if prod_id:
                        cursor.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (qty, prod_id))

                conn.commit()
                self.send_json({
                    "success": True,
                    "order_number": order_number,
                    "total_amount": total_amount,
                    "points_earned": points_earned,
                    "message": "Order successfully created"
                })
                return

            # 4. Validate Coupon
            elif path == "/api/coupons/validate":
                code = body.get("code", "").strip().upper()
                order_amount = float(body.get("order_amount", 0.0))
                if not code:
                    self.send_error_json("Coupon code is required")
                    return

                cursor.execute("SELECT * FROM coupons WHERE code = ? AND active = 1", (code,))
                coupon = cursor.fetchone()
                if not coupon:
                    self.send_error_json("Invalid or expired promo code")
                    return

                coupon_dict = dict(coupon)
                if order_amount < coupon_dict["min_order"]:
                    self.send_error_json(f"Minimum order of ${coupon_dict['min_order']:.2f} required for this code")
                    return

                discount = 0.0
                if coupon_dict["discount_percent"] > 0:
                    discount = round((coupon_dict["discount_percent"] / 100.0) * order_amount, 2)
                elif coupon_dict["flat_discount"] > 0:
                    discount = min(order_amount, coupon_dict["flat_discount"])

                self.send_json({
                    "success": True,
                    "code": coupon_dict["code"],
                    "description": coupon_dict["description"],
                    "discount_amount": discount,
                    "discount_percent": coupon_dict["discount_percent"]
                })
                return

            # 5. Create Coupon (Admin)
            elif path == "/api/coupons":
                code = body.get("code", "").strip().upper()
                discount_percent = float(body.get("discount_percent", 0.0))
                flat_discount = float(body.get("flat_discount", 0.0))
                description = body.get("description", "")
                min_order = float(body.get("min_order", 0.0))

                if not code:
                    self.send_error_json("Coupon code is required")
                    return

                cursor.execute("""
                INSERT INTO coupons (code, discount_percent, flat_discount, description, min_order, active, usage_count)
                VALUES (?, ?, ?, ?, ?, 1, 0)
                """, (code, discount_percent, flat_discount, description, min_order))
                conn.commit()
                self.send_json({"success": True, "id": cursor.lastrowid, "message": "Coupon created"})
                return

            # 6. Submit Review
            elif path == "/api/reviews":
                product_id = body.get("product_id")
                customer_name = body.get("customer_name", "Valued Guest").strip()
                rating = int(body.get("rating", 5))
                comment = body.get("comment", "").strip()

                if not comment:
                    self.send_error_json("Review comment is required")
                    return

                cursor.execute("""
                INSERT INTO reviews (product_id, customer_name, rating, comment, verified_buyer)
                VALUES (?, ?, ?, ?, 1)
                """, (product_id, customer_name, rating, comment))

                # Recalculate product rating if associated with product
                if product_id:
                    cursor.execute("SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM reviews WHERE product_id = ?", (product_id,))
                    stats = cursor.fetchone()
                    if stats and stats["cnt"]:
                        cursor.execute("""
                        UPDATE products SET rating = ROUND(?, 2), review_count = review_count + 1 WHERE id = ?
                        """, (stats["avg_rating"], product_id))

                conn.commit()
                self.send_json({"success": True, "message": "Thank you for sharing your review!"})
                return

            # 7. Add Product (Admin)
            elif path == "/api/products":
                title = body.get("title", "").strip()
                category = body.get("category", "Custom Cakes")
                price = float(body.get("price", 0.0))
                description = body.get("description", "")
                image_url = body.get("image_url", "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80")
                badge = body.get("badge", "New Release")
                dietary_tags = body.get("dietary_tags", "Vegetarian")
                stock = int(body.get("stock", 20))
                is_featured = 1 if body.get("is_featured") else 0

                if not title or price <= 0:
                    self.send_error_json("Valid product title and price are required")
                    return

                cursor.execute("""
                INSERT INTO products (title, category, price, description, image_url, badge, dietary_tags, stock, is_featured, rating, review_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 1)
                """, (title, category, price, description, image_url, badge, dietary_tags, stock, is_featured))
                conn.commit()
                self.send_json({"success": True, "id": cursor.lastrowid, "message": "Product created successfully"})
                return

            # 8. Add Inventory Item (Admin)
            elif path == "/api/inventory":
                item_name = body.get("item_name", "").strip()
                category = body.get("category", "Dry Goods")
                quantity = float(body.get("quantity", 0))
                unit = body.get("unit", "kg")
                min_threshold = float(body.get("min_threshold", 10))
                supplier = body.get("supplier", "Artisan Purveyors")

                if not item_name:
                    self.send_error_json("Item name is required")
                    return

                cursor.execute("""
                INSERT INTO inventory (item_name, category, quantity, unit, min_threshold, supplier)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (item_name, category, quantity, unit, min_threshold, supplier))
                conn.commit()
                self.send_json({"success": True, "id": cursor.lastrowid, "message": "Inventory item added"})
                return

            # 9. Submit Event Inquiry (Custom consultations)
            elif path == "/api/inquiries":
                name = body.get("name", "").strip()
                email = body.get("email", "").strip()
                phone = body.get("phone", "").strip()
                event_date = body.get("event_date", "")
                guest_count = int(body.get("guest_count", 50))
                cake_theme = body.get("cake_theme", "")
                budget_range = body.get("budget_range", "$300 - $500")
                notes = body.get("notes", "")

                if not name or not email or not event_date:
                    self.send_error_json("Name, email, and event date are required")
                    return

                cursor.execute("""
                INSERT INTO inquiries (name, email, phone, event_date, guest_count, cake_theme, budget_range, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New')
                """, (name, email, phone, event_date, guest_count, cake_theme, budget_range, notes))
                conn.commit()
                self.send_json({"success": True, "message": "Inquiry submitted! Our master pastry chef will contact you within 24 hours."})
                return

            # 10. Add or Update Delivery Pincode (Admin / Owner)
            elif path == "/api/admin/pincodes":
                raw_pin = body.get("pincode", "")
                area_name = body.get("area_name", "").strip()
                city = body.get("city", "Bangalore").strip()
                estimated_time = body.get("estimated_time", "30-45 mins").strip()
                delivery_fee = float(body.get("delivery_fee", 0.0))
                is_active = int(body.get("is_active", 1))

                clean_pin = re.sub(r"\D", "", str(raw_pin).strip())
                if not clean_pin or len(clean_pin) != 6:
                    self.send_error_json("Please enter a valid 6-digit Indian postal pincode")
                    return

                if not area_name:
                    self.send_error_json("Locality / Area Name is required")
                    return

                cursor.execute("SELECT id FROM delivery_pincodes WHERE pincode = ?", (clean_pin,))
                existing = cursor.fetchone()
                if existing:
                    cursor.execute("""
                    UPDATE delivery_pincodes
                    SET area_name = ?, city = ?, estimated_time = ?, delivery_fee = ?, is_active = ?
                    WHERE pincode = ?
                    """, (area_name, city, estimated_time, delivery_fee, is_active, clean_pin))
                    p_id = existing["id"]
                    msg = f"Delivery zone {clean_pin} ({area_name}) updated successfully!"
                else:
                    cursor.execute("""
                    INSERT INTO delivery_pincodes (pincode, area_name, city, estimated_time, delivery_fee, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (clean_pin, area_name, city, estimated_time, delivery_fee, is_active))
                    p_id = cursor.lastrowid
                    msg = f"Delivery pincode {clean_pin} ({area_name}) added to active zones!"

                conn.commit()
                self.send_json({"success": True, "id": p_id, "pincode": clean_pin, "message": msg})
                return

            # 11. Image Upload API (Supports direct device uploads from camera or computer)
            elif path == "/api/upload-image":
                image_data = body.get("image_data", "").strip()
                filename = body.get("filename", "product.jpg").strip()
                if not image_data:
                    self.send_error_json("No image data received")
                    return

                try:
                    import base64, time
                    if "base64," in image_data:
                        header, base64_data = image_data.split("base64,", 1)
                        if "png" in header:
                            ext = ".png"
                        elif "webp" in header:
                            ext = ".webp"
                        elif "gif" in header:
                            ext = ".gif"
                        else:
                            ext = ".jpg"
                    else:
                        base64_data = image_data
                        ext = ".jpg"

                    image_bytes = base64.b64decode(base64_data)
                    safe_filename = f"upload_{int(time.time())}_{random.randint(1000, 9999)}{ext}"
                    upload_dir = os.path.join(PUBLIC_DIR, "images", "uploads")
                    os.makedirs(upload_dir, exist_ok=True)
                    target_file = os.path.join(upload_dir, safe_filename)
                    with open(target_file, "wb") as f:
                        f.write(image_bytes)

                    relative_url = f"/images/uploads/{safe_filename}"
                    self.send_json({
                        "success": True,
                        "image_url": relative_url,
                        "filename": safe_filename,
                        "message": "Photo uploaded successfully to bakery media storage!"
                    })
                    return
                except Exception as e:
                    self.send_error_json(f"Upload failed: {str(e)}", 500)
                    return

            else:
                self.send_error_json("POST endpoint not supported", 404)

        finally:
            conn.close()

    def do_PUT(self):
        """Handle PUT requests for updating products, orders, inventory, and coupons."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self.parse_body()

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # 1. Update Order Status (Admin)
            if path.startswith("/api/orders/") and path.endswith("/status"):
                parts = path.split("/")
                order_number = parts[3]
                status = body.get("status")
                chef_notes = body.get("chef_notes")

                if not status:
                    self.send_error_json("Status is required")
                    return

                if chef_notes is not None:
                    cursor.execute("UPDATE orders SET status = ?, chef_notes = ? WHERE order_number = ?", (status, chef_notes, order_number))
                else:
                    cursor.execute("UPDATE orders SET status = ? WHERE order_number = ?", (status, order_number))

                conn.commit()
                self.send_json({"success": True, "message": f"Order {order_number} status updated to {status}"})
                return

            # 2a. Batch Image Update (Admin - Multiple Products at once)
            elif path == "/api/products/batch-images":
                updates = body.get("updates", [])
                if not isinstance(updates, list) or len(updates) == 0:
                    self.send_error_json("A list of product image updates is required")
                    return

                updated_count = 0
                for item in updates:
                    p_id = item.get("id")
                    img_url = (item.get("image_url") or "").strip()
                    if p_id and img_url:
                        cursor.execute("UPDATE products SET image_url = ? WHERE id = ?", (img_url, p_id))
                        updated_count += 1
                conn.commit()
                self.send_json({"success": True, "updated_count": updated_count, "message": f"Successfully updated images for {updated_count} products!"})
                return

            # 2b. Quick Single Product Image Update (Admin)
            elif path.startswith("/api/products/") and (path.endswith("/image") or path.endswith("/image/")):
                try:
                    parts = path.strip("/").split("/")
                    product_id = int(parts[2])
                    img_url = (body.get("image_url") or "").strip()
                    if not img_url:
                        self.send_error_json("Image URL is required")
                        return

                    cursor.execute("SELECT id, title FROM products WHERE id = ?", (product_id,))
                    prod = cursor.fetchone()
                    if not prod:
                        self.send_error_json(f"Product #{product_id} not found in database", 404)
                        return

                    cursor.execute("UPDATE products SET image_url = ? WHERE id = ?", (img_url, product_id))
                    conn.commit()
                    self.send_json({
                        "success": True,
                        "message": f"Product '{prod['title']}' photo updated successfully!",
                        "image_url": img_url,
                        "id": product_id
                    })
                    return
                except (ValueError, IndexError):
                    self.send_error_json("Invalid product ID")
                    return

            # 2c. Update Product Full Details (Admin)
            elif path.startswith("/api/products/"):
                try:
                    product_id = int(path.split("/")[3])
                    title = body.get("title")
                    category = body.get("category")
                    price = float(body.get("price")) if body.get("price") is not None else None
                    description = body.get("description")
                    image_url = body.get("image_url")
                    badge = body.get("badge")
                    dietary_tags = body.get("dietary_tags")
                    stock = body.get("stock")
                    is_featured = 1 if body.get("is_featured") else 0

                    cursor.execute("""
                    UPDATE products SET 
                        title = COALESCE(?, title),
                        category = COALESCE(?, category),
                        price = COALESCE(?, price),
                        description = COALESCE(?, description),
                        image_url = COALESCE(?, image_url),
                        badge = COALESCE(?, badge),
                        dietary_tags = COALESCE(?, dietary_tags),
                        stock = COALESCE(?, stock),
                        is_featured = COALESCE(?, is_featured)
                    WHERE id = ?
                    """, (title, category, price, description, image_url, badge, dietary_tags, stock, is_featured, product_id))
                    conn.commit()
                    self.send_json({"success": True, "message": "Product updated successfully"})
                    return
                except ValueError:
                    self.send_error_json("Invalid product ID")
                    return

            # 3. Update Inventory Quantity / Restock (Admin)
            elif path.startswith("/api/inventory/"):
                try:
                    inv_id = int(path.split("/")[3])
                    quantity = float(body.get("quantity", 0))
                    cursor.execute("UPDATE inventory SET quantity = ?, last_restocked = CURRENT_TIMESTAMP WHERE id = ?", (quantity, inv_id))
                    conn.commit()
                    self.send_json({"success": True, "message": "Stock updated successfully"})
                    return
                except ValueError:
                    self.send_error_json("Invalid inventory ID")
                    return

            # 4. Toggle Coupon Active (Admin)
            elif path.startswith("/api/coupons/") and path.endswith("/toggle"):
                try:
                    coupon_id = int(path.split("/")[3])
                    cursor.execute("UPDATE coupons SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?", (coupon_id,))
                    conn.commit()
                    self.send_json({"success": True, "message": "Coupon status toggled"})
                    return
                except ValueError:
                    self.send_error_json("Invalid coupon ID")
                    return

            # 5. Update Inquiry Status (Admin)
            elif path.startswith("/api/inquiries/") and path.endswith("/status"):
                try:
                    inq_id = int(path.split("/")[3])
                    status = body.get("status", "In Review")
                    cursor.execute("UPDATE inquiries SET status = ? WHERE id = ?", (status, inq_id))
                    conn.commit()
                    self.send_json({"success": True, "message": f"Inquiry status updated to {status}"})
                    return
                except ValueError:
                    self.send_error_json("Invalid inquiry ID")
                    return

            # 6. Toggle Delivery Pincode Active State (Admin)
            elif path.startswith("/api/admin/pincodes/") and path.endswith("/toggle"):
                try:
                    pincode_id = int(path.split("/")[4])
                    cursor.execute("SELECT is_active, pincode, area_name FROM delivery_pincodes WHERE id = ?", (pincode_id,))
                    row = cursor.fetchone()
                    if not row:
                        self.send_error_json("Pincode entry not found", 404)
                        return
                    new_state = 0 if row["is_active"] else 1
                    cursor.execute("UPDATE delivery_pincodes SET is_active = ? WHERE id = ?", (new_state, pincode_id))
                    conn.commit()
                    status_text = "Activated" if new_state else "Paused"
                    self.send_json({
                        "success": True,
                        "is_active": new_state,
                        "message": f"Delivery to {row['pincode']} ({row['area_name']}) {status_text}."
                    })
                    return
                except ValueError:
                    self.send_error_json("Invalid pincode ID")
                    return

            else:
                self.send_error_json("PUT endpoint not supported", 404)

        finally:
            conn.close()

    def do_DELETE(self):
        """Handle DELETE requests for products, coupons, etc."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            if path.startswith("/api/products/"):
                try:
                    product_id = int(path.split("/")[3])
                    cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
                    conn.commit()
                    self.send_json({"success": True, "message": "Product removed"})
                    return
                except ValueError:
                    self.send_error_json("Invalid product ID")
                    return

            elif path.startswith("/api/admin/pincodes/"):
                try:
                    pincode_id = int(path.split("/")[4])
                    cursor.execute("SELECT pincode, area_name FROM delivery_pincodes WHERE id = ?", (pincode_id,))
                    row = cursor.fetchone()
                    if not row:
                        self.send_error_json("Pincode entry not found", 404)
                        return
                    cursor.execute("DELETE FROM delivery_pincodes WHERE id = ?", (pincode_id,))
                    conn.commit()
                    self.send_json({"success": True, "message": f"Pincode {row['pincode']} ({row['area_name']}) removed from delivery zones"})
                    return
                except ValueError:
                    self.send_error_json("Invalid pincode ID")
                    return

            elif path.startswith("/api/customers/"):
                try:
                    customer_id = int(path.split("/")[3])
                    cursor.execute("SELECT id, name, email, role FROM users WHERE id = ?", (customer_id,))
                    user = cursor.fetchone()
                    if not user:
                        self.send_error_json("Customer not found", 404)
                        return
                    if user["role"] != "customer":
                        self.send_error_json("Cannot remove an owner or staff account from the customer directory", 403)
                        return

                    cursor.execute("DELETE FROM users WHERE id = ?", (customer_id,))
                    conn.commit()
                    self.send_json({"success": True, "message": f"Customer '{user['name']}' has been removed from directory."})
                    return
                except ValueError:
                    self.send_error_json("Invalid customer ID")
                    return

            else:
                self.send_error_json("DELETE endpoint not supported", 404)
        finally:
            conn.close()

    def serve_file(self, file_path):
        """Serve static file with proper content type and caching headers."""
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            if file_path.endswith(".js"):
                mime_type = "application/javascript"
            elif file_path.endswith(".css"):
                mime_type = "text/css"
            elif file_path.endswith(".svg"):
                mime_type = "image/svg+xml"
            else:
                mime_type = "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8" if "text" in mime_type or "javascript" in mime_type or "json" in mime_type else mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache, must-revalidate")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {str(e)}")

def run_server():
    init_db()
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    os.makedirs(os.path.join(PUBLIC_DIR, "css"), exist_ok=True)
    os.makedirs(os.path.join(PUBLIC_DIR, "js"), exist_ok=True)
    os.makedirs(os.path.join(PUBLIC_DIR, "assets"), exist_ok=True)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CakeTalkRequestHandler) as httpd:
        print(f"==================================================")
        print(f" CakeTalk Bakery Web Server running on port {PORT}")
        print(f" Customer Website: http://localhost:{PORT}/")
        print(f" Admin Dashboard:  http://localhost:{PORT}/admin")
        print(f"==================================================")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()
