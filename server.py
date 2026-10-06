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
from datetime import datetime
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
                    SELECT u.id, u.name, u.email, u.phone, u.loyalty_points, u.tier, u.created_at,
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
            # 1. Auth: Login
            if path == "/api/auth/login":
                email = body.get("email", "").strip().lower()
                password = body.get("password", "")
                if not email or not password:
                    self.send_error_json("Email and password are required")
                    return

                hashed = hash_password(password)
                cursor.execute("SELECT id, name, email, role, phone, loyalty_points, tier FROM users WHERE email = ? AND password_hash = ?", (email, hashed))
                user = cursor.fetchone()
                if not user:
                    self.send_error_json("Invalid email or password", 401)
                    return
                user_dict = dict(user)
                self.send_json({"success": True, "user": user_dict, "token": f"mock_token_{user_dict['id']}_{random.randint(1000, 9999)}"})
                return

            # 2. Auth: Register
            elif path == "/api/auth/register":
                name = body.get("name", "").strip()
                email = body.get("email", "").strip().lower()
                password = body.get("password", "")
                phone = body.get("phone", "").strip()
                if not name or not email or not password:
                    self.send_error_json("Name, email and password are required")
                    return

                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    self.send_error_json("Email is already registered")
                    return

                hashed = hash_password(password)
                cursor.execute("""
                INSERT INTO users (name, email, password_hash, role, phone, loyalty_points, tier)
                VALUES (?, ?, ?, 'customer', ?, 50, 'Silver Baker')
                """, (name, email, hashed, phone))
                conn.commit()
                user_id = cursor.lastrowid
                user_dict = {
                    "id": user_id, "name": name, "email": email, "role": "customer",
                    "phone": phone, "loyalty_points": 50, "tier": "Silver Baker"
                }
                self.send_json({"success": True, "user": user_dict, "token": f"mock_token_{user_id}_{random.randint(1000, 9999)}"})
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

            # 2. Update Product (Admin)
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
