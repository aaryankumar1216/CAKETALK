# 🎂 CakeTalk — Full-Stack Bakery & Patisserie Platform

A production-ready, full-stack web platform built for **CakeTalk**, serving both bakery customers and owners/management with modern artisanal aesthetics, interactive cake customization, real-time logistics, and an administrative control suite.

---

## 🌟 Key Features Overview

### 1. Customer Experience
- **Artisanal Hero & Branding**: Warm, luxury bakery design matching the visual reference with roasted espresso tones, warm cream accents, and terracotta highlights.
- **Categorized Daily Bakes Menu**: Seamlessly filter by *Artisan Breads*, *Viennoiserie & Pastries*, *Custom Cakes*, *Savory & Sandwiches*, *Gluten-Free & Vegan*, and *Luxury Gift Sets*.
- **Dietary & Lifestyle Filters**: Instant filtering for Gluten-Free, Vegan, Organic, and Nut-Free safe items.
- **Interactive Custom Cake Studio**:
  - Live 2D/3D SVG visualizer that updates dynamically with choices.
  - Sponge selection (Vanilla Bean, Valrhona Chocolate, Red Velvet, Matcha Pistachio).
  - Tiers & Servings (6" Petit, 8" Classic, 2-Tier Grand Celebration).
  - Frosting palettes (Swiss Meringue Buttercream, Dark Chocolate Ganache, Blush Strawberry).
  - Piped Lambeth swags, chocolate drips, and 24K gold botanicals.
  - Real-time personalized greeting plaque rendering customer text directly onto the cake stand.
  - Topper selections (Parisian Macarons, Gold Sparkler Candles, Fresh Berries).
  - Live dynamic price tally and direct add-to-bag integration.
- **Shopping Bag & Checkout Drawer**:
  - Store pickup scheduler vs. local delivery toggle.
  - Promo code coupon engine (`SWEET10` for 10% off, `FREESHIP` for free delivery, `BAKERLOVE` for $5 off).
  - Zip code coverage checker for same-day chilled van delivery.
  - Multi-step checkout with mock credit card, Apple Pay, or cash on pickup.
- **Live Order Tracking**:
  - Search any order code (e.g. `CT-89241`) to view a 4-stage live stepper: *Order Placed* → *In Oven & Baking* → *Decorating* → *Ready / Out for Delivery*.
  - View baker/chef notes and itemized summaries.
- **Crumb Club Loyalty & Gifting**:
  - Loyalty point rewards system (1 point per dollar spent + 50 signup points).
  - Curated gift hampers with handwritten card note options.
- **Customer Reviews & Testimonials**:
  - 4.9★ rating aggregate with verified buyer reviews.
  - "Write a Review" interactive submission form.
- **Bespoke Event Consultations**:
  - Multi-field inquiry form for weddings, corporate galas, and custom catering.

---

### 2. Owner & Admin Management Portal (`/admin`)
- **Secure Authentication**: Protected dashboard gate with staff login (`admin@caketalk.com` / `admin123`).
- **Real-Time Analytics Dashboard**:
  - Total Revenue, Total Orders, Average Order Value, and Active Patrons KPIs.
  - Real-time pipeline status monitor (*Pending*, *In Baking*, *Decorating*, *Ready*, *Delivered*).
  - Category sales distribution and recent order log.
- **Order Management & Workflow**:
  - Full orders directory with customer contact, scheduled pickup/delivery time, and item breakdown.
  - Status dropdown selector that updates the database and reflects immediately on the customer's live tracker.
  - Chef notes editor for custom baking and decoration instructions.
- **Product Catalog Management (CRUD)**:
  - Add new cakes and bakes with images, pricing, categories, badges, and dietary tags.
  - Edit existing items in real-time.
  - Delete discontinued offerings.
- **Inventory & Supply Tracking**:
  - Track flours, Normandy butter, Valrhona chocolate, vanilla beans, and cake boxes.
  - Automated **LOW STOCK REORDER** alerts when supplies dip below minimum thresholds.
  - One-click restock buttons (+20 units) or custom manual adjustments.
- **Customer Directory**:
  - Patron profiles, contact info, Crumb Club tiers, order counts, and lifetime spend totals.
- **Promotions & Coupon Manager**:
  - Create, manage, and toggle active/inactive states for promotional discount codes.
- **Event Consultations Inbox**:
  - Review custom wedding/event requests, guest counts, budgets, and update quote statuses.

---

## 🚀 Single Link Access for Customers & Bakery Admins

Both customers and owners access the complete website through a single URL:

👉 **[http://localhost:8000/](http://localhost:8000/)**

### Seamless 1-Click Role Switcher
Directly in the header of the website, there is a dedicated mode toggle:
- Click **`🥐 Customer View`**: Browse daily bakes, use the interactive Custom Cake Studio, check delivery ZIP coverage, and order online.
- Click **`⚙️ Owner & Admin Suite`**: Instantly switches to the live admin management dashboard (Revenue Analytics, Orders Workflow with status updating, Product Catalog CRUD, Inventory alerts, Customer directory, and Coupons).

You can also switch directly via hash if desired:
- Customer Storefront: `http://localhost:8000/` or `http://localhost:8000/#customer`
- Owner / Admin Suite: `http://localhost:8000/#admin`

### Demo Credentials
- **Admin Email**: `admin@caketalk.com`
- **Admin Password**: `admin123`
- **Sample Order Tracking Code**: `CT-89241`

---

## 📁 Project Architecture

```
CAKETALK/
├── database.py              # SQLite database schema, tables & seed data
├── server.py                # HTTP server & REST API controller
├── test_server.py           # Unit & integration test suite
├── validate_frontend.py     # Frontend integrity validator
├── caketalk.db              # Persistent SQLite database
├── public/
│   ├── index.html           # Customer-facing storefront
│   ├── admin.html           # Owner / Admin management dashboard
│   ├── css/
│   │   ├── variables.css    # Design tokens & color system
│   │   ├── main.css         # Main responsive styles
│   │   ├── custom-builder.css # Interactive Cake Studio styles
│   │   └── admin.css        # Dashboard layouts & tables
│   └── js/
│       ├── api.js           # REST API client
│       ├── cake-builder.js  # Dynamic SVG Cake Studio engine
│       ├── app.js           # Customer storefront controller
│       └── admin.js         # Admin dashboard controller
└── README.md
```
