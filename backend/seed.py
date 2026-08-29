"""Seed DailyBasics DB with demo data (idempotent)."""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@dailybasics.in").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")


def now():
    return datetime.now(timezone.utc)


CATEGORIES = [
    # Food (Ready-to-Serve)
    {"name": "Ready Meals", "icon": "restaurant", "section": "food", "image": "https://images.unsplash.com/photo-1589778655375-3e622a9fc91c?w=400", "order": 1},
    {"name": "Snacks & Chaat", "icon": "fast-food", "section": "food", "image": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400", "order": 2},
    {"name": "Breakfast", "icon": "cafe", "section": "food", "image": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400", "order": 3},
    {"name": "Sweets", "icon": "ice-cream", "section": "food", "image": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400", "order": 4},
    # Daily Essentials
    {"name": "Fruits & Vegetables", "icon": "leaf", "section": "essentials", "image": "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=400", "order": 1},
    {"name": "Dairy & Milk", "icon": "water", "section": "essentials", "image": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400", "order": 2},
    {"name": "Bread & Bakery", "icon": "pizza", "section": "essentials", "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400", "order": 3},
    {"name": "Rice & Atta", "icon": "cube", "section": "essentials", "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400", "order": 4},
    {"name": "Dal & Pulses", "icon": "nutrition", "section": "essentials", "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400", "order": 5},
    {"name": "Oil & Ghee", "icon": "flask", "section": "essentials", "image": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", "order": 6},
    {"name": "Spices & Masala", "icon": "flame", "section": "essentials", "image": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400", "order": 7},
    {"name": "Beverages", "icon": "beer", "section": "essentials", "image": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400", "order": 8},
    {"name": "Tea & Coffee", "icon": "cafe", "section": "essentials", "image": "https://images.unsplash.com/photo-1519683109079-d5f539e1542f?w=400", "order": 9},
    {"name": "Biscuits", "icon": "star", "section": "essentials", "image": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400", "order": 10},
    # Others
    {"name": "Personal Care", "icon": "sparkles", "section": "others", "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400", "order": 1},
    {"name": "Household Cleaning", "icon": "sparkles", "section": "others", "image": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400", "order": 2},
    {"name": "Baby Care", "icon": "happy", "section": "others", "image": "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400", "order": 3},
    {"name": "Pooja Items", "icon": "flower", "section": "others", "image": "https://images.unsplash.com/photo-1604605801370-3396f7fefa73?w=400", "order": 4},
    {"name": "Stationery", "icon": "book", "section": "others", "image": "https://images.unsplash.com/photo-1568871391457-3ebd0a7c3ab8?w=400", "order": 5},
]


def make_products(cat_map):
    def cid(name):
        return cat_map[name]

    return [
        # Food - Ready Meals
        ("Rajma Chawal (Ready to Eat)", "MTR", "Ready Meals", "food", "https://images.unsplash.com/photo-1589778655375-3e622a9fc91c?w=400", 120, 95, "300g", 30, ["rajma", "chawal", "राजमा", "चावल", "meal"], True, True),
        ("Paneer Butter Masala", "Haldiram", "Ready Meals", "food", "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400", 180, 149, "300g", 25, ["paneer", "पनीर", "curry"], True, False),
        ("Dal Makhani", "MTR", "Ready Meals", "food", "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400", 130, 110, "300g", 40, ["dal", "दाल", "makhani"], False, True),
        ("Chole Ready Mix", "Haldiram", "Ready Meals", "food", "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400", 90, 75, "300g", 50, ["chole", "छोले", "chana"], True, False),
        # Food - Snacks & Chaat
        ("Aloo Bhujia", "Haldiram", "Snacks & Chaat", "food", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400", 55, 45, "200g", 100, ["bhujia", "namkeen", "नमकीन"], True, False),
        ("Samosa Pack (6 pcs)", "Local", "Snacks & Chaat", "food", "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400", 80, 60, "6 pcs", 30, ["samosa", "समोसा"], True, True),
        ("Kachori Pack", "Local", "Snacks & Chaat", "food", "https://images.unsplash.com/photo-1626082927389-6cd097cee6a6?w=400", 70, 55, "6 pcs", 40, ["kachori", "कचोरी"], False, False),
        # Food - Breakfast
        ("Poha Ready Mix", "MTR", "Breakfast", "food", "https://images.unsplash.com/photo-1626082927389-6cd097cee6a6?w=400", 45, 38, "200g", 60, ["poha", "पोहा"], False, False),
        ("Upma Instant Mix", "MTR", "Breakfast", "food", "https://images.unsplash.com/photo-1543353071-873f17a7a088?w=400", 50, 42, "200g", 55, ["upma", "उपमा"], False, False),
        # Food - Sweets
        ("Gulab Jamun (Tin)", "Haldiram", "Sweets", "food", "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400", 220, 185, "1 kg", 20, ["gulab jamun", "गुलाब जामुन", "sweet"], True, True),
        ("Rasgulla Tin", "KC Das", "Sweets", "food", "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400", 200, 170, "1 kg", 25, ["rasgulla", "रसगुल्ला"], False, False),
        # Fruits & Vegetables
        ("Fresh Onion (Pyaz)", "Local", "Fruits & Vegetables", "essentials", "https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=400", 40, 30, "1 kg", 200, ["onion", "pyaz", "प्याज"], True, False),
        ("Fresh Potato (Aloo)", "Local", "Fruits & Vegetables", "essentials", "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400", 35, 28, "1 kg", 250, ["potato", "aloo", "आलू"], True, False),
        ("Tomato (Tamatar)", "Local", "Fruits & Vegetables", "essentials", "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400", 60, 45, "1 kg", 150, ["tomato", "tamatar", "टमाटर"], True, False),
        ("Banana (Kela)", "Local", "Fruits & Vegetables", "essentials", "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400", 50, 40, "1 dozen", 100, ["banana", "kela", "केला"], False, True),
        ("Apple (Seb)", "Kashmir", "Fruits & Vegetables", "essentials", "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400", 200, 160, "1 kg", 80, ["apple", "seb", "सेब"], False, True),
        # Dairy
        ("Amul Full Cream Milk", "Amul", "Dairy & Milk", "essentials", "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400", 68, 66, "1 L", 100, ["milk", "doodh", "दूध"], True, True),
        ("Amul Butter", "Amul", "Dairy & Milk", "essentials", "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400", 60, 55, "100g", 80, ["butter", "makkhan"], True, False),
        ("Mother Dairy Curd", "Mother Dairy", "Dairy & Milk", "essentials", "https://images.unsplash.com/photo-1571212515416-fca325abee7c?w=400", 40, 35, "400g", 60, ["curd", "dahi", "दही"], False, False),
        ("Paneer 200g", "Amul", "Dairy & Milk", "essentials", "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400", 95, 85, "200g", 50, ["paneer", "पनीर"], True, False),
        # Bread & Bakery
        ("Britannia White Bread", "Britannia", "Bread & Bakery", "essentials", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400", 45, 42, "400g", 60, ["bread", "double roti"], True, False),
        ("Britannia Brown Bread", "Britannia", "Bread & Bakery", "essentials", "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=400", 55, 50, "400g", 40, ["bread", "brown bread"], False, False),
        # Rice & Atta
        ("Aashirvaad Atta", "Aashirvaad", "Rice & Atta", "essentials", "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400", 320, 285, "5 kg", 80, ["atta", "आटा", "wheat", "flour"], True, True),
        ("India Gate Basmati Rice", "India Gate", "Rice & Atta", "essentials", "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400", 450, 399, "5 kg", 50, ["rice", "chawal", "चावल", "basmati"], True, True),
        ("Sona Masuri Rice", "Fortune", "Rice & Atta", "essentials", "https://images.unsplash.com/photo-1568347355280-d33fdf77d42a?w=400", 380, 340, "5 kg", 40, ["rice", "sona masuri"], False, False),
        # Dal & Pulses
        ("Toor Dal 1kg", "Tata Sampann", "Dal & Pulses", "essentials", "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400", 180, 155, "1 kg", 60, ["toor", "arhar", "अरहर", "dal"], True, False),
        ("Moong Dal 1kg", "Tata Sampann", "Dal & Pulses", "essentials", "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400", 160, 140, "1 kg", 50, ["moong", "मूंग", "dal"], False, False),
        ("Chana Dal 1kg", "Fortune", "Dal & Pulses", "essentials", "https://images.unsplash.com/photo-1596797882870-8c33dedb6d97?w=400", 130, 115, "1 kg", 55, ["chana", "चना"], False, False),
        # Oil & Ghee
        ("Fortune Sunflower Oil", "Fortune", "Oil & Ghee", "essentials", "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", 210, 185, "1 L", 90, ["oil", "tel", "तेल"], True, True),
        ("Amul Cow Ghee", "Amul", "Oil & Ghee", "essentials", "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400", 620, 555, "1 L", 40, ["ghee", "घी"], True, True),
        ("Saffola Gold Oil", "Saffola", "Oil & Ghee", "essentials", "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", 240, 215, "1 L", 60, ["oil", "saffola"], False, False),
        # Spices
        ("Tata Salt", "Tata", "Spices & Masala", "essentials", "https://images.unsplash.com/photo-1518110925495-b37e912f6b48?w=400", 30, 28, "1 kg", 200, ["salt", "namak", "नमक"], True, False),
        ("Turmeric Powder", "MDH", "Spices & Masala", "essentials", "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400", 90, 78, "200g", 80, ["haldi", "हल्दी", "turmeric"], False, False),
        ("Red Chilli Powder", "Everest", "Spices & Masala", "essentials", "https://images.unsplash.com/photo-1583475020831-fb4fdf2eab72?w=400", 95, 82, "200g", 70, ["mirchi", "मिर्च", "chilli"], False, False),
        ("Garam Masala", "MDH", "Spices & Masala", "essentials", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400", 85, 72, "100g", 60, ["masala", "मसाला"], True, False),
        # Beverages
        ("Coca Cola 2L", "Coca-Cola", "Beverages", "essentials", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400", 95, 89, "2 L", 40, ["coke", "cola", "cold drink"], True, False),
        ("Sprite 1.25L", "Coca-Cola", "Beverages", "essentials", "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400", 70, 65, "1.25 L", 45, ["sprite", "cold drink"], False, False),
        ("Real Fruit Juice Mixed", "Real", "Beverages", "essentials", "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400", 120, 105, "1 L", 30, ["juice", "जूस"], False, False),
        # Tea & Coffee
        ("Tata Tea Gold", "Tata Tea", "Tea & Coffee", "essentials", "https://images.unsplash.com/photo-1519683109079-d5f539e1542f?w=400", 275, 249, "500g", 70, ["tea", "chai", "चाय"], True, True),
        ("Bru Instant Coffee", "Bru", "Tea & Coffee", "essentials", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", 200, 180, "100g", 50, ["coffee", "कॉफी"], False, False),
        ("Red Label Tea", "Brooke Bond", "Tea & Coffee", "essentials", "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400", 260, 235, "500g", 60, ["tea", "chai", "चाय"], True, False),
        # Biscuits
        ("Parle-G Original", "Parle", "Biscuits", "essentials", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400", 30, 28, "800g", 150, ["biscuit", "parle g", "पारले"], True, True),
        ("Britannia Good Day", "Britannia", "Biscuits", "essentials", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400", 40, 35, "200g", 100, ["biscuit", "cookies"], False, False),
        ("Marie Gold", "Britannia", "Biscuits", "essentials", "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400", 30, 27, "150g", 120, ["marie", "biscuit"], False, False),
        # Personal Care
        ("Dettol Soap", "Dettol", "Personal Care", "others", "https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?w=400", 45, 40, "125g", 100, ["soap", "साबुन"], True, False),
        ("Colgate Toothpaste", "Colgate", "Personal Care", "others", "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=400", 90, 82, "150g", 80, ["toothpaste", "colgate"], True, False),
        ("Head & Shoulders Shampoo", "H&S", "Personal Care", "others", "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400", 195, 175, "180ml", 40, ["shampoo", "शैम्पू"], False, False),
        # Household
        ("Surf Excel Easy Wash", "Surf Excel", "Household Cleaning", "others", "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400", 195, 175, "1 kg", 60, ["detergent", "surf"], True, False),
        ("Vim Dishwash Bar", "Vim", "Household Cleaning", "others", "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400", 30, 28, "300g", 100, ["dishwash", "vim"], False, False),
        # Baby Care
        ("Cerelac Wheat Apple", "Nestle", "Baby Care", "others", "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400", 290, 275, "300g", 40, ["baby food", "cerelac"], False, True),
        ("Pampers Diapers M", "Pampers", "Baby Care", "others", "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400", 599, 549, "44 pcs", 30, ["diaper", "pampers"], True, False),
        # Pooja
        ("Agarbatti Pack", "Cycle", "Pooja Items", "others", "https://images.unsplash.com/photo-1604605801370-3396f7fefa73?w=400", 60, 50, "10 sticks", 100, ["agarbatti", "अगरबत्ती"], False, False),
    ]


COUPONS = [
    {"code": "WELCOME50", "type": "flat", "value": 50, "min_order": 299, "message": "₹50 off your first order", "is_active": True, "once_per_user": True},
    {"code": "SAVE20", "type": "percent", "value": 20, "max_discount": 100, "min_order": 199, "message": "20% off (max ₹100)", "is_active": True, "once_per_user": False},
    {"code": "FREEDEL", "type": "free_delivery", "value": 0, "min_order": 149, "message": "Free delivery", "is_active": True, "once_per_user": False},
]


ZONES = [
    {"name": "Village Core (Zone A)", "pincodes": ["110001", "110002", "110003"], "delivery_charge": 10, "min_order_value": 99, "eta_minutes": 30, "is_active": True},
    {"name": "Nearby Villages (Zone B)", "pincodes": ["201301", "201302", "221001"], "delivery_charge": 20, "min_order_value": 149, "eta_minutes": 45, "is_active": True},
]


CUSTOMERS = [
    ("9999900001", "Ramu Kaka"),
    ("9999900002", "Sunita Devi"),
    ("9999900003", "Pooja Sharma"),
    ("9999900004", "Rakesh Verma"),
    ("9999900005", "Vinod Yadav"),
]


PARTNERS = [
    ("9888800001", "Ramesh Kumar"),
    ("9888800002", "Suresh Yadav"),
    ("9888800003", "Amit Sharma"),
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # 1. Admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL, "role": "admin"})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "role": "admin",
            "name": "Store Admin",
            "password_hash": bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt(rounds=12)).decode(),
            "created_at": now(),
            "is_active": True,
        })
        print("✔ Admin created")
    else:
        print("• Admin exists")

    # 2. Categories
    cat_map = {}
    for c in CATEGORIES:
        found = await db.categories.find_one({"name": c["name"]})
        if found:
            cat_map[c["name"]] = found["id"]
        else:
            cid = str(uuid.uuid4())
            await db.categories.insert_one({**c, "id": cid, "is_active": True, "created_at": now()})
            cat_map[c["name"]] = cid
    print(f"✔ Categories: {len(cat_map)}")

    # 3. Products
    products = make_products(cat_map)
    added = 0
    for name, brand, cat, section, image, mrp, price, unit, stock, keywords, best, feat in products:
        if await db.products.find_one({"name": name, "brand": brand}):
            continue
        await db.products.insert_one({
            "id": str(uuid.uuid4()),
            "name": name,
            "brand": brand,
            "description": f"{name} - {unit}",
            "category_id": cat_map[cat],
            "category_name": cat,
            "section": section,
            "image_url": image,
            "mrp": float(mrp),
            "price": float(price),
            "unit": unit,
            "stock": stock,
            "sold_count": 0,
            "keywords": keywords,
            "is_bestseller": best,
            "is_featured": feat,
            "is_active": True,
            "created_at": now(),
        })
        added += 1
    print(f"✔ Products added: {added} (total {len(products)})")

    # 4. Coupons
    for c in COUPONS:
        await db.coupons.update_one({"code": c["code"]}, {"$set": c}, upsert=True)
    print("✔ Coupons ready")

    # 5. Zones
    for z in ZONES:
        await db.delivery_zones.update_one({"name": z["name"]}, {"$set": z}, upsert=True)
    print("✔ Zones ready")

    # 6. Customers (backfill referral_code + wallet_balance for existing/new)
    import secrets as _s
    def _mk_code(name):
        letters = "".join(c for c in (name or "USER").upper() if c.isalpha())[:3] or "DBM"
        letters = (letters + "XYZ")[:3]
        return f"{letters}{_s.randbelow(1000):03d}"

    for phone, name in CUSTOMERS:
        existing = await db.users.find_one({"phone": phone, "role": "customer"})
        if not existing:
            code = _mk_code(name)
            while await db.users.find_one({"referral_code": code}):
                code = _mk_code(name)
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "phone": phone, "name": name, "role": "customer",
                "referral_code": code, "referred_by": None, "wallet_balance": 0.0, "referral_credited": False,
                "created_at": now(), "is_active": True,
            })
        elif not existing.get("referral_code"):
            code = _mk_code(name)
            while await db.users.find_one({"referral_code": code}):
                code = _mk_code(name)
            await db.users.update_one({"id": existing["id"]}, {"$set": {"referral_code": code, "wallet_balance": existing.get("wallet_balance", 0.0), "referral_credited": False}})
    print("✔ Customers ready")

    # 7. Delivery Partners
    for phone, name in PARTNERS:
        if not await db.users.find_one({"phone": phone, "role": "delivery_partner"}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "phone": phone, "name": name, "role": "delivery_partner",
                "created_at": now(), "is_active": True,
            })
    print("✔ Delivery partners ready")

    client.close()
    print("✅ Seeding complete")


if __name__ == "__main__":
    asyncio.run(main())
