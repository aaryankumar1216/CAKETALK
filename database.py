"""
CakeTalk Bakery Platform - SQLite Database Layer & Seed Data
Provides persistent storage for Products, Orders, Custom Cake Builds,
Reviews, Inventory, Inquiries, Coupons, and Users (Admin & Customer).
"""

import sqlite3
import hashlib
import json
import os
from datetime import datetime, timedelta

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "caketalk.db")

def hash_password(password: str) -> str:
    """Hash password with sha256 salt."""
    return hashlib.sha256(("caketalk_salt_" + password).encode("utf-8")).hexdigest()

def get_db_connection():
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables and seed initial data if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        phone TEXT,
        pincode TEXT,
        loyalty_points INTEGER DEFAULT 50,
        tier TEXT DEFAULT 'Silver Baker',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Ensure pincode column exists if table was created previously
    cursor.execute("PRAGMA table_info(users)")
    existing_cols = [col[1] for col in cursor.fetchall()]
    if "pincode" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN pincode TEXT")

    # 2. Products Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT NOT NULL,
        badge TEXT,
        dietary_tags TEXT,
        stock INTEGER DEFAULT 25,
        is_featured INTEGER DEFAULT 0,
        rating REAL DEFAULT 4.9,
        review_count INTEGER DEFAULT 18,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        order_type TEXT NOT NULL, -- 'pickup' or 'delivery'
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        delivery_address TEXT,
        items_json TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        delivery_fee REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status TEXT DEFAULT 'Paid',
        status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'In Baking', 'Decorating', 'Ready', 'Delivered'
        chef_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Custom Cakes Table (connected to orders or standalone designs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS custom_cakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT,
        sponge_flavor TEXT NOT NULL,
        size_tiers TEXT NOT NULL,
        frosting TEXT NOT NULL,
        filling TEXT NOT NULL,
        design_style TEXT NOT NULL,
        inscription TEXT,
        extras TEXT,
        calculated_price REAL NOT NULL,
        config_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. Reviews Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        customer_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        verified_buyer INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 6. Inventory Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        min_threshold REAL NOT NULL,
        supplier TEXT,
        last_restocked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. Inquiries Table (Custom Event consultations)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        event_date TEXT NOT NULL,
        guest_count INTEGER NOT NULL,
        cake_theme TEXT,
        budget_range TEXT,
        notes TEXT,
        status TEXT DEFAULT 'New', -- 'New', 'In Review', 'Quoted', 'Confirmed'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 8. Coupons Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_percent REAL NOT NULL,
        flat_discount REAL DEFAULT 0,
        description TEXT,
        min_order REAL DEFAULT 0,
        active INTEGER DEFAULT 1,
        usage_count INTEGER DEFAULT 0
    );
    """)

    # 9. Mobile OTP Verifications Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 10. Delivery Pincodes Table (Owner managed serviceable delivery zones)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS delivery_pincodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pincode TEXT UNIQUE NOT NULL,
        area_name TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT 'Bangalore',
        estimated_time TEXT DEFAULT '30-45 mins',
        delivery_fee REAL DEFAULT 0.0,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()

    # Seed data if tables are empty
    seed_users(conn)
    seed_products(conn)
    seed_orders(conn)
    seed_inventory(conn)
    seed_reviews(conn)
    seed_coupons(conn)
    seed_inquiries(conn)
    seed_delivery_pincodes(conn)

    conn.close()
    print("Database initialized successfully at:", DB_FILE)

def seed_users(conn):
    cursor = conn.cursor()
    admin_pass = hash_password("admin123")
    owner_pass = hash_password("owner123")
    cust_pass = hash_password("customer123")

    users_to_seed = [
        ('Aaryan Kumar (Bakery Owner)', 'owner@caketalk.com', owner_pass, 'admin', '9988776655', 500, 'Master Baker'),
        ('Eleanor Vance (Head Baker)', 'admin@caketalk.com', admin_pass, 'admin', '+1 (555) 234-5678', 500, 'Master Baker'),
        ('Pooja Sharma (Patron)', 'customer@caketalk.com', cust_pass, 'customer', '9876543210', 150, 'Golden Sweet Tooth'),
        ('Sophie Martin', 'sophie@example.com', cust_pass, 'customer', '+1 (555) 876-5432', 180, 'Golden Sweet Tooth'),
        ('Liam Chen', 'liam@example.com', cust_pass, 'customer', '+1 (555) 345-6789', 95, 'Silver Baker')
    ]

    for name, email, pw_hash, role, phone, points, tier in users_to_seed:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if not cursor.fetchone():
            cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, phone, loyalty_points, tier)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (name, email, pw_hash, role, phone, points, tier))
    conn.commit()

def seed_products(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        products = [
            # ------------------ SNACKS (10 items) ------------------
            (
                "Veg Puff",
                "Snacks",
                25.0,
                "Yummy vegetable puff with sauce.",
                "/images/products/veg-puff.jpg",
                "Popular",
                "Veg",
                45, 1, 4.8, 42
            ),
            (
                "Mushroom Puff",
                "Snacks",
                30.0,
                "It's pure veg mushroom.",
                "/images/products/mushroom-puff.png",
                "Fresh Bake",
                "Veg",
                35, 1, 4.8, 31
            ),
            (
                "Aloo Bun",
                "Snacks",
                25.0,
                "It's aloo bhaji masala.",
                "/images/products/aloo-bun.jpg",
                "Classic",
                "Veg",
                40, 0, 4.7, 26
            ),
            (
                "Masala Bun",
                "Snacks",
                25.0,
                "It's spicy with masala.",
                "/images/products/masala-bun.jpg",
                "SPICY",
                "Veg",
                50, 1, 4.9, 58
            ),
            (
                "Plain Curry Puff",
                "Snacks",
                70.0,
                "It's a shanks time spicy",
                "/images/products/plain-curry-puff.jpg",
                "SPICY",
                "Veg",
                30, 0, 4.6, 21
            ),
            (
                "Donuts 1pc",
                "Snacks",
                45.0,
                "It's chocolate fell",
                "/images/products/donuts.png",
                "Chocolate",
                "Veg",
                30, 0, 4.7, 34
            ),
            (
                "Cream Bun",
                "Snacks",
                55.0,
                "(Veg preparation) It's a good feel with cream.",
                "/images/products/cream-bun.jpg",
                "Kids Favorite",
                "Veg",
                35, 0, 4.8, 48
            ),
            (
                "Jum Bun",
                "Snacks",
                55.0,
                "Jam mix",
                "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=800&q=80",
                "Sweet Jam",
                "Veg",
                25, 0, 4.6, 25
            ),
            (
                "Lava Cake",
                "Snacks",
                40.0,
                "Chocolate fell",
                "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
                "Hot Favorite",
                "Veg",
                40, 1, 4.9, 72
            ),
            (
                "Pakoda 250g",
                "Snacks",
                95.0,
                "It's a shanks time.",
                "/images/products/pakoda.png",
                "Tea Time Snack",
                "Veg",
                30, 0, 4.7, 38
            ),

            # ------------------ COOKIES (2 items) ------------------
            (
                "Special Cookies (250 g, 6 Pieces)",
                "Cookies",
                110.0,
                "Crispy freshly baked traditional bakery cookies.",
                "/images/products/special-cookies.png",
                "Iyengar Special",
                "Veg",
                45, 1, 4.9, 61
            ),
            (
                "Salt and sweet biscuit",
                "Cookies",
                110.0,
                "Its a biscuit with badam",
                "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=800&q=80",
                "Badam Special",
                "Veg",
                40, 1, 4.8, 45
            ),

            # ------------------ LJ SPECIALS (18 items) ------------------
            (
                "Special Rusk (500 grm)",
                "LJ Specials",
                115.0,
                "Yummy",
                "/images/products/special-rusk.png",
                "Bestseller",
                "Veg",
                55, 1, 4.9, 67
            ),
            (
                "Rusk (250 g)",
                "LJ Specials",
                60.0,
                "Sweet rusk",
                "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=800&q=80",
                "Daily Rusk",
                "Veg",
                45, 0, 4.7, 35
            ),
            (
                "Special Bread",
                "LJ Specials",
                60.0,
                "Tea with bread.",
                "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=800&q=80",
                "Fresh Loaf",
                "Veg",
                60, 0, 4.8, 52
            ),
            (
                "Special Bun",
                "LJ Specials",
                35.0,
                "It's a bun.",
                "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
                "Soft Bun",
                "Veg",
                40, 0, 4.6, 29
            ),
            (
                "Wheat Bread",
                "LJ Specials",
                80.0,
                "It's a healthy bread.",
                "/images/products/wheat-bread.png",
                "Healthy Choice",
                "Veg",
                35, 0, 4.8, 38
            ),
            (
                "Khara Bun",
                "LJ Specials",
                35.0,
                "Spicy",
                "/images/products/khara-bun.jpg",
                "SPICY",
                "Veg",
                50, 1, 4.9, 81
            ),
            (
                "Pav bhaji bun",
                "LJ Specials",
                40.0,
                "Soft pillowy pav buns for pav bhaji.",
                "/images/products/pav-bhaji-bun.png",
                "Soft Pav",
                "Veg",
                45, 0, 4.7, 31
            ),
            (
                "Dilpasand",
                "LJ Specials",
                115.0,
                "Dry fruits.",
                "/images/products/dilpasand.png",
                "Authentic Treat",
                "Veg",
                35, 1, 4.9, 69
            ),
            (
                "Kova Dilpasand",
                "LJ Specials",
                130.0,
                "Sweet.",
                "/images/products/kova-dilpasand.png",
                "Khoya Rich",
                "Veg",
                28, 1, 4.9, 54
            ),
            (
                "Plain Cake",
                "LJ Specials",
                80.0,
                "Cake with plain",
                "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=800&q=80",
                "Tea Cake",
                "Veg",
                35, 0, 4.7, 41
            ),
            (
                "Flame Cake (250 g)",
                "LJ Specials",
                90.0,
                "It's a cake with chocolate",
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
                "Chocolate Rich",
                "Veg",
                32, 0, 4.8, 46
            ),
            (
                "Fruit Cake (250 g)",
                "LJ Specials",
                90.0,
                "It's dry fruits cake.",
                "/images/products/fruit-cake.png",
                "Tutti Frutti",
                "Veg",
                38, 0, 4.8, 49
            ),
            (
                "Banana Cake (250 g)",
                "LJ Specials",
                100.0,
                "Fresh golden banana tea cake.",
                "/images/products/banana-cake.png",
                "Naturally Sweet",
                "Veg",
                28, 0, 4.7, 33
            ),
            (
                "Puliyogare (250 g)",
                "LJ Specials",
                110.0,
                "Rice mix",
                "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80",
                "Traditional Mix",
                "Veg",
                35, 0, 4.9, 63
            ),
            (
                "Puliyogare (500 g)",
                "LJ Specials",
                180.0,
                "Rice mix",
                "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
                "Family Pack",
                "Veg",
                30, 0, 4.9, 52
            ),
            (
                "Home Biscuit",
                "LJ Specials",
                70.0,
                "Jeera",
                "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=800&q=80",
                "Jeera Salted",
                "Veg",
                42, 0, 4.6, 28
            ),
            (
                "Popcorn (1 Piece)",
                "LJ Specials",
                40.0,
                "Popcorn",
                "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=800&q=80",
                "Snack",
                "Veg",
                50, 0, 4.5, 23
            ),
            (
                "Layan Millet (500 g)",
                "LJ Specials",
                300.0,
                "Protein powder.",
                "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
                "Health Superfood",
                "Veg",
                20, 0, 4.8, 20
            ),

            # ------------------ SPECIAL MIXER WITH SHANKS (3 items) ------------------
            (
                "Special Kaju Mixture (250 g)",
                "Special Mixer with Shanks",
                110.0,
                "Shanks.",
                "/images/products/special-kaju-mixture.png",
                "Crunchy Cashew",
                "Veg",
                42, 1, 4.9, 59
            ),
            (
                "Special Kaju Mixture (500 g)",
                "Special Mixer with Shanks",
                210.0,
                "Shanks.",
                "/images/products/special-kaju-mixture.png",
                "Party Pack",
                "Veg",
                35, 0, 4.9, 44
            ),
            (
                "Benne Murukku (250 g)",
                "Special Mixer with Shanks",
                85.0,
                "It's a shanks with tea.",
                "/images/products/benne-murukku.jpg",
                "Butter Crisp",
                "Veg",
                48, 1, 4.8, 51
            ),

            # ------------------ BIRTHDAY CAKE (9 items) ------------------
            (
                "Pineapple Ice Cake (1 kg)",
                "Birthday Cake",
                600.0,
                "Pineapple crush with full cake.",
                "https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=800&q=80",
                "Celebration Favorite",
                "Veg",
                16, 1, 4.9, 84
            ),
            (
                "Blueberry Pastry (1 kg)",
                "Birthday Cake",
                600.0,
                "Blueberry crush.",
                "/images/products/blueberry-pastry.png",
                "Berry Delight",
                "Veg",
                15, 1, 4.9, 69
            ),
            (
                "Butterscotch Ice Cake (1 kg)",
                "Birthday Cake",
                700.0,
                "Crunchy butterscotch praline with rich caramel ice cream finish.",
                "https://images.unsplash.com/photo-1562777717-dc6984f65a63?auto=format&fit=crop&w=800&q=80",
                "Caramel Crunch",
                "Veg",
                14, 0, 4.8, 57
            ),
            (
                "Badam Pista Cake (1 kg)",
                "Birthday Cake",
                750.0,
                "Badam pista mix with crush.",
                "/images/products/badam-pista-cake.jpg",
                "Royal Festive",
                "Veg",
                12, 1, 4.9, 63
            ),
            (
                "Irish Coffee Cake (1 kg)",
                "Birthday Cake",
                700.0,
                "Rich espresso coffee infused sponge with mocha cream.",
                "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=800&q=80",
                "Mocha Velvet",
                "Veg",
                12, 0, 4.8, 47
            ),
            (
                "Choco Oreo Cake (1 kg)",
                "Birthday Cake",
                750.0,
                "Oreo with chocolate.",
                "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80",
                "Cookies & Cream",
                "Veg",
                16, 1, 4.9, 89
            ),
            (
                "Red Velvet Ice Cake (1 kg)",
                "Birthday Cake",
                750.0,
                "Yummy ice with cream.",
                "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=800&q=80",
                "Velvet Cream",
                "Veg",
                15, 1, 4.9, 76
            ),
            (
                "Chocolate Ice Cake Truffle (1 kg)",
                "Birthday Cake",
                700.0,
                "Chocolate with truffle.",
                "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=800&q=80",
                "Truffle Glaze",
                "Veg",
                18, 1, 5.0, 98
            ),
            (
                "Chocolate Cake Normal (1 kg)",
                "Birthday Cake",
                450.0,
                "Classic chocolate sponge cake with rich chocolate frosting.",
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
                "Classic Celebration",
                "Veg",
                20, 0, 4.8, 62
            )
        ]

        cursor.executemany("""
        INSERT INTO products (title, category, price, description, image_url, badge, dietary_tags, stock, is_featured, rating, review_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, products)
        conn.commit()

def seed_orders(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM orders")
    if cursor.fetchone()[0] == 0:
        sample_orders = [
            (
                "CT-89241",
                "Elena Rostova",
                "elena.rostova@example.com",
                "+91 98450 12345",
                "delivery",
                datetime.now().strftime("%Y-%m-%d"),
                "14:30 - 15:30",
                "Flat 4B, Prestige Heights, Bangalore",
                json.dumps([
                    {"id": 34, "title": "Pineapple Ice Cake (1 kg)", "price": 600.0, "quantity": 1, "custom_details": "Inscription: 'Happy Birthday Elena!'"},
                    {"id": 1, "title": "Veg Puff", "price": 25.0, "quantity": 4}
                ]),
                700.0, 70.0, 0.0, 630.0,
                "UPI (Google Pay)", "Paid", "In Baking",
                "Eggless preparation confirmed. Provide candles and knife."
            ),
            (
                "CT-89242",
                "Marcus Vance",
                "marcus.v@example.com",
                "+91 97420 54321",
                "pickup",
                (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
                "10:00 - 11:00",
                "Bakery Store Pickup",
                json.dumps([
                    {"id": 41, "title": "Chocolate Ice Cake Truffle (1 kg)", "price": 700.0, "quantity": 1, "custom_details": "Extra chocolate curls"}
                ]),
                700.0, 0, 0, 700.0,
                "UPI / Card", "Paid", "Decorating",
                "Customer requested extra chocolate flakes on side."
            ),
            (
                "CT-89240",
                "Chloe Jenkins",
                "chloe.j@example.com",
                "+91 98860 67890",
                "delivery",
                (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
                "11:00 - 12:00",
                "No. 12, 4th Cross, Malleshwaram",
                json.dumps([
                    {"id": 13, "title": "Special Rusk (500 grm)", "price": 115.0, "quantity": 2},
                    {"id": 11, "title": "Special Cookies (250 g, 6 Pieces)", "price": 110.0, "quantity": 1}
                ]),
                340.0, 30.0, 0.0, 310.0,
                "Card on Delivery", "Paid", "Delivered",
                "Hand delivered to front desk."
            ),
            (
                "CT-89243",
                "Julian Ross",
                "julian.ross@example.com",
                "+91 99001 23456",
                "pickup",
                datetime.now().strftime("%Y-%m-%d"),
                "16:00 - 17:00",
                "Bakery Store Pickup",
                json.dumps([
                    {"id": 36, "title": "Butterscotch Ice Cake (1 kg)", "price": 700.0, "quantity": 1, "custom_details": "Size: 1 kg, Inscription: 'Happy 25th Anniversary'"}
                ]),
                700.0, 0, 0, 700.0,
                "UPI (PhonePe)", "Paid", "Ready",
                "Chilling in bakery walk-in fridge #2."
            )
        ]

        cursor.executemany("""
        INSERT INTO orders (
            order_number, customer_name, customer_email, customer_phone,
            order_type, scheduled_date, scheduled_time, delivery_address,
            items_json, subtotal, discount, delivery_fee, total_amount,
            payment_method, payment_status, status, chef_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_orders)
        conn.commit()

def seed_inventory(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM inventory")
    if cursor.fetchone()[0] == 0:
        items = [
            ("Organic Maida Flour", "Dry Goods", 185.0, "kg", 50.0, "Bangalore Grain Mills"),
            ("Fresh Dairy Butter", "Dairy", 38.0, "kg", 20.0, "Nandini Milk Dairy"),
            ("Rich Chocolate Couverture", "Chocolates", 14.5, "kg", 15.0, "Morde Chocolate"),  # Low stock
            ("Vanilla Extract & Crushed Pods", "Flavorings", 1.2, "kg", 1.0, "Sprig Flavors"),        # Low stock
            ("Fresh Cream & Milk", "Dairy", 45.0, "liters", 25.0, "Nandini Dairy"),
            ("Tutti Frutti & Mixed Dry Fruits", "Decorations", 12.0, "kg", 5.0, "Royal Dry Fruits"),
            ("Pure Ghee (Cow Ghee)", "Dairy", 25.0, "kg", 10.0, "Nandini"),
            ("Eco-Friendly Cake Boxes 1kg", "Packaging", 92.0, "units", 40.0, "GreenBake Pak"),
            ("Bakery Paper Bags & Pouches", "Packaging", 220.0, "units", 50.0, "EcoPouch Bangalore")
        ]
        cursor.executemany("""
        INSERT INTO inventory (item_name, category, quantity, unit, min_threshold, supplier)
        VALUES (?, ?, ?, ?, ?, ?)
        """, items)
        conn.commit()

def seed_reviews(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM reviews")
    if cursor.fetchone()[0] == 0:
        reviews = [
            (34, "Hannah Sterling", 5, "The Pineapple Ice Cake was the crown jewel of our birthday dinner! Super moist sponge and fresh tropical fruit crush.", 1),
            (41, "Chef Dominic Miller", 5, "Superb chocolate truffle. Rich Belgian-style cocoa notes and velvety texture. Truly authentic Iyengar quality.", 1),
            (1, "Amelia Davis", 5, "The Veg Puff and Masala Bun are out of this world! Piping hot, flaky layers and perfect spices.", 1),
            (13, "David K.", 5, "The Special Rusk is crunchy and so aromatic with evening chai. An absolute daily must-have.", 1),
            (20, "Jessica Alba-Lane", 5, "The Dilpasand and Kova Dilpasand are royal masterpieces! Stuffed with so many dry fruits and sweet coconut.", 1)
        ]
        cursor.executemany("""
        INSERT INTO reviews (product_id, customer_name, rating, comment, verified_buyer)
        VALUES (?, ?, ?, ?, ?)
        """, reviews)
        conn.commit()

def seed_coupons(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM coupons")
    if cursor.fetchone()[0] == 0:
        coupons = [
            ("SWEET10", 10.0, 0, "10% off your entire bakery order", 200.0, 1, 14),
            ("FREESHIP", 0.0, 40.0, "Free local delivery on orders over ₹300", 300.0, 1, 28),
            ("BAKERLOVE", 15.0, 0, "15% off celebration & birthday cakes", 500.0, 1, 9),
            ("WELCOME50", 0.0, 50.0, "₹50 off your first bakery order", 250.0, 1, 35)
        ]
        cursor.executemany("""
        INSERT INTO coupons (code, discount_percent, flat_discount, description, min_order, active, usage_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, coupons)
        conn.commit()

def seed_inquiries(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM inquiries")
    if cursor.fetchone()[0] == 0:
        inquiries = [
            ("Victoria & Robert Spencer", "v.spencer@weddingbliss.com", "+1 (555) 912-3401", "2026-11-20", 120, "3-Tier Botanical Rustic Wedding Cake with pressed edible flowers", "$600 - $800", "Outdoor garden wedding at The Grove. Need delivery by 2 PM.", "In Review"),
            ("Apex Tech Annual Gala", "events@apextech.io", "+1 (555) 678-9012", "2026-12-05", 250, "Branded Corporate Cake Tower + 200 Macaron favor boxes", "$1,200+", "Company 10th anniversary. Logo plaque in dark blue and gold required.", "Quoted")
        ]
        cursor.executemany("""
        INSERT INTO inquiries (name, email, phone, event_date, guest_count, cake_theme, budget_range, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, inquiries)
        conn.commit()

def seed_delivery_pincodes(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM delivery_pincodes")
    if cursor.fetchone()[0] == 0:
        pincodes = [
            ("562106", "Anekal Town & Market", "Bangalore Rural", "30-45 mins", 0.0, 1),
            ("560100", "Electronic City Phase 1 & 2", "Bangalore", "35-50 mins", 30.0, 1),
            ("560099", "Bommasandra Industrial Area & Jigani", "Bangalore", "35-45 mins", 20.0, 1),
            ("562107", "Chandapura & Surya City", "Bangalore", "30-40 mins", 0.0, 1),
            ("560034", "Koramangala (Blocks 1-8)", "Bangalore", "45-60 mins", 40.0, 1),
            ("560102", "HSR Layout (Sectors 1-7)", "Bangalore", "40-55 mins", 35.0, 1),
            ("560068", "Madiwala & Silk Board", "Bangalore", "45-60 mins", 40.0, 1),
            ("560076", "Bannerghatta Road & Hulimavu", "Bangalore", "45-60 mins", 35.0, 1)
        ]
        cursor.executemany("""
        INSERT INTO delivery_pincodes (pincode, area_name, city, estimated_time, delivery_fee, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
        """, pincodes)
        conn.commit()

if __name__ == "__main__":
    init_db()
