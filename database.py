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
        loyalty_points INTEGER DEFAULT 50,
        tier TEXT DEFAULT 'Silver Baker',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

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

    conn.commit()

    # Seed data if tables are empty
    seed_users(conn)
    seed_products(conn)
    seed_orders(conn)
    seed_inventory(conn)
    seed_reviews(conn)
    seed_coupons(conn)
    seed_inquiries(conn)

    conn.close()
    print("Database initialized successfully at:", DB_FILE)

def seed_users(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        admin_pass = hash_password("admin123")
        cust_pass = hash_password("customer123")
        cursor.execute("""
        INSERT INTO users (name, email, password_hash, role, phone, loyalty_points, tier)
        VALUES 
        ('Eleanor Vance (Head Baker)', 'admin@caketalk.com', ?, 'admin', '+1 (555) 234-5678', 500, 'Master Baker'),
        ('Sophie Martin', 'sophie@example.com', ?, 'customer', '+1 (555) 876-5432', 180, 'Golden Sweet Tooth'),
        ('Liam Chen', 'liam@example.com', ?, 'customer', '+1 (555) 345-6789', 95, 'Silver Baker')
        """, (admin_pass, cust_pass, cust_pass))
        conn.commit()

def seed_products(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        products = [
            # Artisan Breads
            (
                "Traditional Country Sourdough",
                "Artisan Breads",
                10.50,
                "Naturally fermented 36-hour wild levain loaf with a blistered, caramelised crust and tender, airy crumb.",
                "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=800&q=80",
                "Wild Ferment",
                "Vegan, Organic",
                30, 1, 4.95, 42
            ),
            (
                "Olive & Rosemary Focaccia",
                "Artisan Breads",
                12.00,
                "Ligurian-style golden focaccia drenched in cold-pressed extra virgin olive oil, Kalamata olives, and fresh organic rosemary.",
                "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80",
                "Daily Bake",
                "Vegan",
                20, 0, 4.88, 28
            ),
            (
                "Seeded Rye & Spelt Batard",
                "Artisan Breads",
                11.00,
                "Hearty ancient grains blend packed with toasted pumpkin, sunflower, and golden flax seeds with deep nutty notes.",
                "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
                "High Fiber",
                "Vegan, Whole Grain",
                18, 0, 4.82, 19
            ),

            # Viennoiserie & Pastries
            (
                "Pure French Butter Croissant",
                "Viennoiserie",
                4.75,
                "72 delicate honeycomb layers laminated with cultured Normandy butter (84% butterfat) for the ultimate flaky shatter.",
                "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
                "Bestseller",
                "Vegetarian",
                45, 1, 4.98, 86
            ),
            (
                "Valrhona Pain au Chocolat",
                "Viennoiserie",
                5.50,
                "Flaky golden laminated pastry rolled with double batons of 66% Valrhona French dark chocolate.",
                "https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&w=800&q=80",
                "Chef's Choice",
                "Vegetarian",
                35, 1, 4.94, 64
            ),
            (
                "Pistachio & Cardamom Cruffin",
                "Viennoiserie",
                6.50,
                "Croissant-muffin hybrid dusted in fragrant spiced sugar and filled with rich Sicilian pistachio pastry cream.",
                "https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=800&q=80",
                "Seasonal",
                "Vegetarian",
                25, 0, 4.90, 31
            ),
            (
                "Almond Frangipane Twist",
                "Viennoiserie",
                5.75,
                "Twice-baked croissant pastry filled with rich almond cream, topped with toasted sliced almonds and powdered sugar.",
                "https://images.unsplash.com/photo-1623334044303-241021148842?auto=format&fit=crop&w=800&q=80",
                "Morning Classic",
                "Vegetarian",
                22, 0, 4.86, 24
            ),

            # Custom Cakes & Celebration Cakes
            (
                "Madagascar Vanilla & Raspberry Silk Cake",
                "Custom Cakes",
                48.00,
                "Three layers of delicate sponge infused with bourbon vanilla beans, tart raspberry compote, and silky Swiss meringue buttercream.",
                "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80",
                "Signature Cake",
                "Vegetarian, Nut-Free",
                15, 1, 4.97, 53
            ),
            (
                "Belgian Dark Truffle Ganache Cake",
                "Custom Cakes",
                54.00,
                "Decadent dark chocolate layers soaked in coffee liqueur, smothered in mirror chocolate ganache and cocoa nib crisp.",
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
                "Crowd Favorite",
                "Vegetarian",
                12, 1, 4.96, 71
            ),
            (
                "Matcha Green Tea & White Peach Gateau",
                "Custom Cakes",
                52.00,
                "Uji ceremonial grade matcha chiffon cake paired with sweet Japanese white peach gelée and whipped mascarpone cream.",
                "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
                "Artisan Special",
                "Vegetarian",
                10, 0, 4.89, 39
            ),
            (
                "Vintage Lambeth Birthday Cake",
                "Custom Cakes",
                62.00,
                "Victorian over-piped buttercream masterpiece with intricate borders, maraschino cherries, and customizable greeting plaque.",
                "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80",
                "Trending Design",
                "Vegetarian",
                8, 1, 4.99, 47
            ),

            # Savory & Sandwiches
            (
                "Heirloom Tomato & Whipped Feta Galette",
                "Savory & Sandwiches",
                8.50,
                "All-butter flaky pastry crust filled with herb-infused goat feta, ripe organic heirloom tomatoes, and aged balsamic glaze.",
                "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
                "Lunch Favorite",
                "Vegetarian",
                20, 0, 4.85, 23
            ),
            (
                "Truffled Prosciutto & Brie Baguette",
                "Savory & Sandwiches",
                13.50,
                "Crispy artisanal baguette with thinly sliced San Daniele prosciutto, creamy French Brie, wild arugula, and white truffle honey.",
                "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=800&q=80",
                "Gourmet Deli",
                "Nut-Free",
                16, 1, 4.92, 35
            ),

            # Gluten-Free & Vegan
            (
                "Gluten-Free Orange Blossom & Almond Loaf",
                "Gluten-Free & Vegan",
                14.00,
                "Naturally flourless cake made with blanched almonds, citrus zest, and wildflower honey syrup.",
                "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=800&q=80",
                "Gluten-Free",
                "Gluten-Free, Dairy-Free",
                15, 1, 4.91, 33
            ),
            (
                "Vegan Salted Caramel Chocolate Cupcake Box (4pk)",
                "Gluten-Free & Vegan",
                18.00,
                "Rich dark cacao sponge filled with house-made dairy-free coconut caramel and velvety fudge swirl frosting.",
                "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=800&q=80",
                "100% Plant-Based",
                "Vegan, Dairy-Free",
                20, 0, 4.87, 29
            ),

            # Luxury Gift Sets
            (
                "The Master Baker's Breakfast Hamper",
                "Gift Sets",
                45.00,
                "Curated wicker basket featuring fresh country sourdough, 2 butter croissants, organic blackberry jam, and artisan roast coffee beans.",
                "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
                "Gifting Pick",
                "Artisan Selection",
                12, 1, 4.98, 41
            ),
            (
                "Parisian Macaron Gift Collection (12pk)",
                "Gift Sets",
                32.00,
                "Handcrafted almond meringue shells filled with dark ganache, Tahitian vanilla, salted caramel, pistachio, and passion fruit curd.",
                "https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=800&q=80",
                "Luxury Box",
                "Gluten-Free, Vegetarian",
                25, 1, 4.95, 59
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
                "+1 (555) 321-9988",
                "delivery",
                datetime.now().strftime("%Y-%m-%d"),
                "14:30 - 15:30",
                "452 Elm Street, Suite 4B, Metro City",
                json.dumps([
                    {"id": 8, "title": "Madagascar Vanilla & Raspberry Silk Cake", "price": 48.00, "quantity": 1, "custom_details": "8-inch, Inscription: 'Happy 30th Elena!'"},
                    {"id": 4, "title": "Pure French Butter Croissant", "price": 4.75, "quantity": 4}
                ]),
                67.00, 6.70, 5.00, 65.30,
                "Credit Card (Visa ending in 4242)", "Paid", "In Baking",
                "Allergies noted: Nut-free facility requested."
            ),
            (
                "CT-89242",
                "Marcus Vance",
                "marcus.v@example.com",
                "+1 (555) 777-1234",
                "pickup",
                (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
                "10:00 - 11:00",
                "Bakery Store Pickup",
                json.dumps([
                    {"id": 9, "title": "Belgian Dark Truffle Ganache Cake", "price": 54.00, "quantity": 1, "custom_details": "Triple chocolate filling, gold sparkler"}
                ]),
                54.00, 0, 0, 54.00,
                "Apple Pay", "Paid", "Decorating",
                "Customer requested extra chocolate flakes on side."
            ),
            (
                "CT-89240",
                "Chloe Jenkins",
                "chloe.j@example.com",
                "+1 (555) 888-4321",
                "delivery",
                (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
                "11:00 - 12:00",
                "1240 Magnolia Boulevard, Apt 12",
                json.dumps([
                    {"id": 1, "title": "Traditional Country Sourdough", "price": 10.50, "quantity": 2},
                    {"id": 17, "title": "Parisian Macaron Gift Collection (12pk)", "price": 32.00, "quantity": 1}
                ]),
                53.00, 5.00, 5.00, 53.00,
                "Credit Card (Mastercard 9012)", "Paid", "Delivered",
                "Hand delivered to front desk."
            ),
            (
                "CT-89243",
                "Julian Ross",
                "julian.ross@example.com",
                "+1 (555) 444-9090",
                "pickup",
                datetime.now().strftime("%Y-%m-%d"),
                "16:00 - 17:00",
                "Bakery Store Pickup",
                json.dumps([
                    {"id": 11, "title": "Vintage Lambeth Birthday Cake", "price": 62.00, "quantity": 1, "custom_details": "Size: 10-inch, Inscription: 'Forever Fabulous'"}
                ]),
                62.00, 0, 0, 62.00,
                "Credit Card", "Paid", "Ready",
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
            ("Organic Unbleached Wheat Flour", "Dry Goods", 185.0, "kg", 50.0, "King Arthur Milling"),
            ("Normandy Cultured Butter 84%", "Dairy", 38.0, "kg", 20.0, "Isigny Sainte-Mère"),
            ("Valrhona 66% Dark Chocolate Couverture", "Chocolates", 14.5, "kg", 15.0, "Valrhona France"),  # Low stock
            ("Bourbon Vanilla Beans (Madagascar)", "Flavorings", 1.2, "kg", 1.0, "Nielsen-Massey"),        # Low stock
            ("Pasteurized Cage-Free Egg Whites", "Dairy/Eggs", 45.0, "liters", 25.0, "Valley Farm Fresh"),
            ("Freeze-Dried Raspberry Powder", "Decorations", 4.2, "kg", 3.0, "Sosa Ingredients"),
            ("Gold Leaf Sheets (24 Karat Edible)", "Decorations", 180.0, "sheets", 50.0, "Barnabas Gold"),
            ("Eco-Friendly Bakery Cake Boxes 10\"", "Packaging", 92.0, "units", 40.0, "GreenBake Pak"),
            ("Satin Ribbon (Terracotta Gold)", "Packaging", 22.0, "rolls", 10.0, "Boutique Ribbons")
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
            (8, "Hannah Sterling", 5, "The Madagascar Vanilla & Raspberry cake was the crown jewel of our anniversary dinner! Buttercream was ethereal and not cloyingly sweet.", 1),
            (9, "Chef Dominic Miller", 5, "Superb chocolate balance. The Valrhona notes shine through without being bitter. You can tell they use top-tier European butter.", 1),
            (4, "Amelia Davis", 5, "I lived in Paris for 3 years, and CakeTalk's croissants are genuinely the only ones in town that rival the French bakeries.", 1),
            (1, "David K.", 5, "The sourdough crust has that unmistakable crackle and sourdough tang. Excellent hydration and open crumb.", 1),
            (11, "Jessica Alba-Lane", 5, "The Lambeth piping on my sister's birthday cake looked like a museum piece. Everyone was taking photos for Instagram!", 1)
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
            ("SWEET10", 10.0, 0, "10% off your entire order", 30.0, 1, 14),
            ("FREESHIP", 0.0, 5.0, "Free local delivery on orders over $40", 40.0, 1, 28),
            ("BAKERLOVE", 15.0, 0, "15% off custom celebration cakes", 50.0, 1, 9),
            ("WELCOME5", 0.0, 5.0, "$5 off your first artisan pastry order", 20.0, 1, 35)
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

if __name__ == "__main__":
    init_db()
