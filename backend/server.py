"""DailyBasics — Hyperlocal Grocery + Food Delivery Backend"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import bcrypt
import jwt
import razorpay
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("dailybasics")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))
OTP_EXPIRE_SECONDS = int(os.environ.get("OTP_EXPIRE_SECONDS", "300"))
DEV_MOCK_OTP = os.environ.get("DEV_MOCK_OTP", "true").lower() == "true"

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
RAZORPAY_ENABLED = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and not RAZORPAY_KEY_ID.endswith("placeholder"))
rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_ENABLED else None

client = AsyncIOMotorClient(MONGO_URL, tz_aware=True)
db = client[DB_NAME]

app = FastAPI(title="DailyBasics API")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


PHONE_RE = re.compile(r"^\d{10}$")


def normalize_phone(phone: str) -> str:
    p = re.sub(r"\D", "", phone or "")
    if p.startswith("91") and len(p) == 12:
        p = p[2:]
    if not PHONE_RE.match(p):
        raise HTTPException(400, "Please enter a valid 10-digit Indian mobile number")
    return p


# ------------ Models ------------
class Role(str, Enum):
    customer = "customer"
    delivery_partner = "delivery_partner"
    admin = "admin"


class RequestOtp(BaseModel):
    phone: str
    role: Role


class VerifyOtp(BaseModel):
    phone: str
    role: Role
    code: str
    name: Optional[str] = None


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    user: dict


class AddressIn(BaseModel):
    label: str = "Home"
    house: str
    landmark: Optional[str] = ""
    village: str
    pincode: str
    phone: str
    instructions: Optional[str] = ""


class CartItem(BaseModel):
    product_id: str
    quantity: int = Field(gt=0, le=100)


class PlaceOrderIn(BaseModel):
    address_id: str
    items: list[CartItem]
    coupon_code: Optional[str] = None
    payment_method: str = "cod"  # cod | upi | online
    instructions: Optional[str] = ""


class UpdateOrderStatus(BaseModel):
    status: str
    delivery_partner_id: Optional[str] = None
    otp: Optional[str] = None
    collected_amount: Optional[float] = None


class ProductIn(BaseModel):
    name: str
    brand: Optional[str] = ""
    description: Optional[str] = ""
    category_id: str
    section: str = "essentials"
    image_url: Optional[str] = ""
    mrp: float
    price: float
    unit: str = "1 pc"
    stock: int = 100
    keywords: list[str] = []
    is_bestseller: bool = False
    is_featured: bool = False
    is_active: bool = True


# ------------ Auth helpers ------------
bearer = HTTPBearer(auto_error=False)


def create_token(uid: str, role: str) -> str:
    payload = {
        "sub": uid,
        "role": role,
        "iat": now(),
        "exp": now() + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"], "role": payload["role"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise ValueError("user gone")
        return user
    except Exception as e:
        logger.warning(f"auth failed: {e}")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")


def require_roles(*allowed: Role):
    async def dep(user: dict = Depends(current_user)):
        if user["role"] not in [r.value for r in allowed]:
            raise HTTPException(403, "Insufficient permissions")
        return user

    return dep


# ------------ Serializers ------------
def clean(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    d = {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


# ------------ AUTH ROUTES ------------
@app.post("/api/auth/otp/request")
async def request_otp(body: RequestOtp):
    if body.role == Role.admin:
        raise HTTPException(400, "Admins must log in via email/password")
    phone = normalize_phone(body.phone)
    code = f"{secrets.randbelow(1_000_000):06d}"
    digest = hashlib.sha256(code.encode()).hexdigest()
    await db.otp_challenges.update_one(
        {"phone": phone, "role": body.role.value},
        {
            "$set": {
                "code_hash": digest,
                "expires_at": now() + timedelta(seconds=OTP_EXPIRE_SECONDS),
                "attempts": 0,
            }
        },
        upsert=True,
    )
    logger.info(f"[MOCK OTP] {phone} ({body.role.value}): {code}")
    resp = {"message": "OTP sent successfully"}
    if DEV_MOCK_OTP:
        resp["mock_otp"] = code
    return resp


@app.post("/api/auth/otp/verify", response_model=TokenResponse)
async def verify_otp(body: VerifyOtp):
    if body.role == Role.admin:
        raise HTTPException(400, "Admins must log in via email/password")
    phone = normalize_phone(body.phone)
    c = await db.otp_challenges.find_one({"phone": phone, "role": body.role.value})
    if not c or c["expires_at"] <= now() or c.get("attempts", 0) >= 5:
        raise HTTPException(401, "OTP expired or too many attempts. Please request again.")
    await db.otp_challenges.update_one({"_id": c["_id"]}, {"$inc": {"attempts": 1}})
    if not hmac.compare_digest(c["code_hash"], hashlib.sha256(body.code.encode()).hexdigest()):
        raise HTTPException(401, "Incorrect OTP. Please try again.")

    existing = await db.users.find_one({"phone": phone, "role": body.role.value})
    if existing:
        user_id = existing["id"]
        if body.name and not existing.get("name"):
            await db.users.update_one({"id": user_id}, {"$set": {"name": body.name}})
    else:
        # New delivery partners must be pre-approved by admin
        if body.role == Role.delivery_partner:
            raise HTTPException(403, "Delivery partner not approved. Contact admin.")
        user_id = str(uuid.uuid4())
        await db.users.insert_one(
            {
                "id": user_id,
                "phone": phone,
                "role": body.role.value,
                "name": body.name or "",
                "created_at": now(),
                "is_active": True,
            }
        )

    await db.otp_challenges.delete_one({"_id": c["_id"]})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    token = create_token(user_id, body.role.value)
    return TokenResponse(access_token=token, role=Role(body.role.value), user=clean(user))


@app.post("/api/auth/admin/login", response_model=TokenResponse)
async def admin_login(body: AdminLogin):
    u = await db.users.find_one({"email": body.email.lower(), "role": Role.admin.value})
    if not u or not bcrypt.checkpw(body.password.encode(), u["password_hash"].encode()):
        raise HTTPException(401, "Invalid email or password")
    token = create_token(u["id"], Role.admin.value)
    return TokenResponse(access_token=token, role=Role.admin, user=clean(u))


@app.get("/api/auth/me")
async def me(user: dict = Depends(current_user)):
    return user


# ------------ CATEGORIES ------------
@app.get("/api/categories")
async def list_categories(section: Optional[str] = None):
    q = {"is_active": True}
    if section:
        q["section"] = section
    cats = await db.categories.find(q, {"_id": 0}).sort("order", 1).to_list(200)
    return cats


# ------------ PRODUCTS ------------
def _search_query(term: str) -> dict:
    t = term.strip()
    if not t:
        return {}
    # search name/brand/keywords case-insensitive
    rx = re.compile(re.escape(t), re.IGNORECASE)
    return {"$or": [{"name": rx}, {"brand": rx}, {"keywords": rx}]}


@app.get("/api/products")
async def list_products(
    section: Optional[str] = None,
    category_id: Optional[str] = None,
    q: Optional[str] = None,
    bestseller: Optional[bool] = None,
    featured: Optional[bool] = None,
    sort: Optional[str] = None,  # price_asc | price_desc | popularity
    limit: int = 100,
    skip: int = 0,
):
    query: dict = {"is_active": True}
    if section:
        query["section"] = section
    if category_id:
        query["category_id"] = category_id
    if bestseller:
        query["is_bestseller"] = True
    if featured:
        query["is_featured"] = True
    if q:
        query.update(_search_query(q))
    sort_key = [("_id", 1)]
    if sort == "price_asc":
        sort_key = [("price", 1)]
    elif sort == "price_desc":
        sort_key = [("price", -1)]
    elif sort == "popularity":
        sort_key = [("sold_count", -1)]
    items = await db.products.find(query, {"_id": 0}).sort(sort_key).skip(skip).limit(limit).to_list(limit)
    return items


@app.get("/api/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@app.post("/api/products")
async def create_product(body: ProductIn, admin: dict = Depends(require_roles(Role.admin))):
    pid = str(uuid.uuid4())
    doc = body.model_dump()
    doc.update({"id": pid, "sold_count": 0, "created_at": now()})
    await db.products.insert_one(doc)
    return clean(doc)


@app.put("/api/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, admin: dict = Depends(require_roles(Role.admin))):
    r = await db.products.update_one({"id": product_id}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Product not found")
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    return p


@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(require_roles(Role.admin))):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


# ------------ ADDRESSES ------------
@app.get("/api/addresses")
async def list_addresses(user: dict = Depends(require_roles(Role.customer))):
    items = await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    return items


@app.post("/api/addresses")
async def create_address(body: AddressIn, user: dict = Depends(require_roles(Role.customer))):
    aid = str(uuid.uuid4())
    doc = body.model_dump()
    doc.update({"id": aid, "user_id": user["id"], "created_at": now()})
    await db.addresses.insert_one(doc)
    return clean(doc)


@app.delete("/api/addresses/{address_id}")
async def delete_address(address_id: str, user: dict = Depends(require_roles(Role.customer))):
    await db.addresses.delete_one({"id": address_id, "user_id": user["id"]})
    return {"ok": True}


# ------------ DELIVERY ZONES / SERVICEABILITY ------------
@app.get("/api/delivery/check/{pincode}")
async def check_delivery(pincode: str):
    z = await db.delivery_zones.find_one({"pincodes": pincode, "is_active": True}, {"_id": 0})
    if not z:
        return {"serviceable": False, "message": "Currently we don't deliver to this location."}
    return {
        "serviceable": True,
        "zone": z["name"],
        "delivery_charge": z["delivery_charge"],
        "min_order_value": z["min_order_value"],
        "eta_minutes": z["eta_minutes"],
    }


@app.get("/api/delivery/zones")
async def list_zones(admin: dict = Depends(require_roles(Role.admin))):
    return await db.delivery_zones.find({}, {"_id": 0}).to_list(100)


# ------------ COUPONS ------------
@app.post("/api/coupons/apply")
async def apply_coupon(payload: dict, user: dict = Depends(require_roles(Role.customer))):
    code = (payload.get("code") or "").upper().strip()
    subtotal = float(payload.get("subtotal") or 0)
    c = await db.coupons.find_one({"code": code, "is_active": True}, {"_id": 0})
    if not c:
        raise HTTPException(400, "Invalid coupon code")
    if subtotal < c.get("min_order", 0):
        raise HTTPException(400, f"Minimum order ₹{c['min_order']} required")
    if c.get("once_per_user"):
        already = await db.coupon_redemptions.find_one({"user_id": user["id"], "code": code})
        if already:
            raise HTTPException(400, "This coupon can only be used once")
    discount = 0.0
    if c["type"] == "flat":
        discount = float(c["value"])
    elif c["type"] == "percent":
        discount = round(subtotal * float(c["value"]) / 100, 2)
        if c.get("max_discount"):
            discount = min(discount, float(c["max_discount"]))
    elif c["type"] == "free_delivery":
        discount = 0.0
    return {"code": code, "discount": discount, "free_delivery": c["type"] == "free_delivery", "message": c.get("message", "Coupon applied")}


# ------------ ORDERS ------------
ORDER_FLOW = ["placed", "confirmed", "preparing", "packed", "out_for_delivery", "delivered", "cancelled"]


@app.post("/api/orders")
async def place_order(body: PlaceOrderIn, user: dict = Depends(require_roles(Role.customer))):
    address = await db.addresses.find_one({"id": body.address_id, "user_id": user["id"]}, {"_id": 0})
    if not address:
        raise HTTPException(400, "Address not found")

    zone = await db.delivery_zones.find_one({"pincodes": address["pincode"], "is_active": True}, {"_id": 0})
    if not zone:
        raise HTTPException(400, "We don't deliver to this location")

    if not body.items:
        raise HTTPException(400, "Cart is empty")

    # Compute totals & check stock
    prod_ids = [i.product_id for i in body.items]
    products = {p["id"]: p for p in await db.products.find({"id": {"$in": prod_ids}}, {"_id": 0}).to_list(200)}
    order_items = []
    subtotal = 0.0
    savings = 0.0
    for it in body.items:
        if it.quantity <= 0 or it.quantity > 100:
            raise HTTPException(400, "Invalid item quantity")
        p = products.get(it.product_id)
        if not p or not p.get("is_active", True):
            raise HTTPException(400, f"Product unavailable")
        if p["stock"] < it.quantity:
            raise HTTPException(400, f"'{p['name']}' has only {p['stock']} in stock")
        subtotal += p["price"] * it.quantity
        savings += (p["mrp"] - p["price"]) * it.quantity
        order_items.append({
            "product_id": p["id"],
            "name": p["name"],
            "brand": p.get("brand", ""),
            "image_url": p.get("image_url", ""),
            "unit": p.get("unit", ""),
            "price": p["price"],
            "mrp": p["mrp"],
            "quantity": it.quantity,
            "line_total": round(p["price"] * it.quantity, 2),
        })

    if subtotal < zone["min_order_value"]:
        raise HTTPException(400, f"Minimum order value is ₹{zone['min_order_value']}")

    delivery_charge = float(zone["delivery_charge"])
    coupon_discount = 0.0
    coupon_applied = None
    coupon_doc = None
    if body.coupon_code:
        c = await db.coupons.find_one({"code": body.coupon_code.upper(), "is_active": True}, {"_id": 0})
        if c and subtotal >= c.get("min_order", 0):
            if c.get("once_per_user"):
                already = await db.coupon_redemptions.find_one({"user_id": user["id"], "code": c["code"]})
                if already:
                    raise HTTPException(400, "This coupon can only be used once")
            if c["type"] == "flat":
                coupon_discount = float(c["value"])
            elif c["type"] == "percent":
                coupon_discount = round(subtotal * c["value"] / 100, 2)
                if c.get("max_discount"):
                    coupon_discount = min(coupon_discount, float(c["max_discount"]))
            elif c["type"] == "free_delivery":
                delivery_charge = 0.0
            coupon_applied = c["code"]
            coupon_doc = c

    total = round(subtotal + delivery_charge - coupon_discount, 2)
    order_id = str(uuid.uuid4())
    order_number = f"DB{now().strftime('%y%m%d')}{secrets.randbelow(10000):04d}"
    otp_code = f"{secrets.randbelow(10000):04d}"

    doc = {
        "id": order_id,
        "order_number": order_number,
        "user_id": user["id"],
        "user_name": user.get("name") or "",
        "user_phone": user.get("phone") or "",
        "address": address,
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "delivery_charge": delivery_charge,
        "coupon_code": coupon_applied,
        "coupon_discount": coupon_discount,
        "total": total,
        "savings": round(savings, 2),
        "payment_method": body.payment_method,
        "payment_status": "pending" if body.payment_method == "cod" else "pending",
        "status": "placed",
        "delivery_partner_id": None,
        "delivery_otp": otp_code,
        "instructions": body.instructions or "",
        "eta_minutes": zone["eta_minutes"],
        "zone_name": zone["name"],
        "status_history": [{"status": "placed", "at": now().isoformat()}],
        "created_at": now(),
    }
    await db.orders.insert_one(doc)

    # Record coupon redemption (once_per_user enforcement)
    if coupon_applied and coupon_doc and coupon_doc.get("once_per_user"):
        try:
            await db.coupon_redemptions.insert_one({
                "user_id": user["id"],
                "code": coupon_applied,
                "order_id": order_id,
                "created_at": now(),
            })
        except Exception as e:
            logger.warning(f"coupon redemption insert failed: {e}")

    # Reduce stock
    for it in body.items:
        await db.products.update_one(
            {"id": it.product_id},
            {"$inc": {"stock": -it.quantity, "sold_count": it.quantity}},
        )

    # Razorpay: create RP order for online payments
    if body.payment_method == "online":
        if not RAZORPAY_ENABLED:
            resp = clean(doc)
            resp["razorpay_enabled"] = False
            resp["razorpay_message"] = "Online payment not configured yet. Please pay via COD or ask admin to add Razorpay keys."
            return resp
        try:
            amount_paise = int(round(total * 100))
            rp_order = rzp_client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": order_number,
                "notes": {"order_id": order_id, "user_id": user["id"]},
                "payment_capture": 1,
            })
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"razorpay_order_id": rp_order["id"], "razorpay_amount_paise": amount_paise}},
            )
            doc["razorpay_order_id"] = rp_order["id"]
            doc["razorpay_amount_paise"] = amount_paise
        except Exception as e:
            logger.error(f"Razorpay order create failed: {e}")
            await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": "failed"}})
            raise HTTPException(502, "Could not initialise online payment")

    resp = clean(doc)
    resp["razorpay_enabled"] = RAZORPAY_ENABLED
    resp["razorpay_key_id"] = RAZORPAY_KEY_ID if RAZORPAY_ENABLED else None
    return resp


def _strip_delivery_otp(order: dict, user_role: str) -> dict:
    """Delivery OTP is proof-of-delivery. Only the customer sees it; delivery
    partners must ask the customer to share it verbally, and admin dashboard
    doesn't need it either."""
    if user_role != Role.customer.value and "delivery_otp" in order:
        order = {k: v for k, v in order.items() if k != "delivery_otp"}
    return order


@app.get("/api/orders")
async def list_orders(user: dict = Depends(current_user), status_filter: Optional[str] = Query(None, alias="status")):
    q: dict = {}
    if user["role"] == Role.customer.value:
        q["user_id"] = user["id"]
    elif user["role"] == Role.delivery_partner.value:
        q["delivery_partner_id"] = user["id"]
    if status_filter:
        q["status"] = status_filter
    items = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for it in items:
        if isinstance(it.get("created_at"), datetime):
            it["created_at"] = it["created_at"].isoformat()
        out.append(_strip_delivery_otp(it, user["role"]))
    return out


@app.get("/api/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["role"] == Role.customer.value and o["user_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == Role.delivery_partner.value and o.get("delivery_partner_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if isinstance(o.get("created_at"), datetime):
        o["created_at"] = o["created_at"].isoformat()
    return _strip_delivery_otp(o, user["role"])


@app.patch("/api/orders/{order_id}/status")
async def update_status(order_id: str, body: UpdateOrderStatus, user: dict = Depends(current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    new_status = body.status
    if new_status not in ORDER_FLOW:
        raise HTTPException(400, "Invalid status")

    # role checks
    role = user["role"]
    if role == Role.customer.value:
        if new_status != "cancelled" or o["status"] in ("out_for_delivery", "delivered"):
            raise HTTPException(403, "Cannot change status")
        if o["user_id"] != user["id"]:
            raise HTTPException(403, "Forbidden")
    elif role == Role.delivery_partner.value:
        if o.get("delivery_partner_id") != user["id"]:
            raise HTTPException(403, "Not assigned to you")
        if new_status not in ("out_for_delivery", "delivered"):
            raise HTTPException(403, "Cannot set that status")
        if new_status == "delivered":
            if body.otp != o.get("delivery_otp"):
                raise HTTPException(400, "Incorrect delivery OTP")

    update = {"status": new_status}
    if body.delivery_partner_id and role == Role.admin.value:
        update["delivery_partner_id"] = body.delivery_partner_id
    if body.collected_amount is not None and new_status == "delivered":
        update["collected_amount"] = body.collected_amount
        update["payment_status"] = "paid"
    hist_entry = {"status": new_status, "at": now().isoformat(), "by": user["id"]}
    await db.orders.update_one(
        {"id": order_id},
        {"$set": update, "$push": {"status_history": hist_entry}},
    )

    # Restore stock if cancelled
    if new_status == "cancelled" and o["status"] != "cancelled":
        for it in o["items"]:
            await db.products.update_one(
                {"id": it["product_id"]},
                {"$inc": {"stock": it["quantity"], "sold_count": -it["quantity"]}},
            )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), datetime):
        updated["created_at"] = updated["created_at"].isoformat()
    return updated


@app.post("/api/orders/{order_id}/assign")
async def assign_partner(order_id: str, payload: dict, admin: dict = Depends(require_roles(Role.admin))):
    partner_id = payload.get("delivery_partner_id")
    p = await db.users.find_one({"id": partner_id, "role": Role.delivery_partner.value, "is_active": True})
    if not p:
        raise HTTPException(400, "Delivery partner not found or inactive")
    r = await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {"delivery_partner_id": partner_id, "delivery_partner_name": p.get("name"), "delivery_partner_phone": p.get("phone"), "status": "confirmed"},
            "$push": {"status_history": {"status": "confirmed", "at": now().isoformat(), "by": admin["id"]}},
        },
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Order not found")
    return {"ok": True}


# ------------ PAYMENTS (RAZORPAY) ------------
class VerifyPayment(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@app.get("/api/payments/config")
async def payments_config():
    return {"razorpay_enabled": RAZORPAY_ENABLED, "razorpay_key_id": RAZORPAY_KEY_ID if RAZORPAY_ENABLED else None}


@app.post("/api/payments/razorpay/verify")
async def verify_razorpay(body: VerifyPayment, user: dict = Depends(require_roles(Role.customer))):
    if not RAZORPAY_ENABLED:
        raise HTTPException(400, "Razorpay not configured")
    order = await db.orders.find_one({"id": body.order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("razorpay_order_id") != body.razorpay_order_id:
        raise HTTPException(400, "Order mismatch")
    try:
        rzp_client.utility.verify_payment_signature({
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
    except Exception:
        raise HTTPException(400, "Invalid payment signature")
    await db.orders.update_one(
        {"id": body.order_id},
        {"$set": {
            "razorpay_payment_id": body.razorpay_payment_id,
            "payment_status": "paid",
            "status": "confirmed",
            "payment_verified_at": now(),
        },
         "$push": {"status_history": {"status": "confirmed", "at": now().isoformat()}}},
    )
    return {"ok": True, "payment_status": "paid"}


@app.post("/api/payments/razorpay/webhook", include_in_schema=False)
async def razorpay_webhook_real(req: Request):
    if not RAZORPAY_WEBHOOK_SECRET:
        return {"ok": True, "skipped": True}
    raw = await req.body()
    sig = req.headers.get("x-razorpay-signature") or ""
    import hashlib as _h, hmac as _hm
    expected = _hm.new(RAZORPAY_WEBHOOK_SECRET.encode(), raw, _h.sha256).hexdigest()
    if not _hm.compare_digest(expected, sig):
        raise HTTPException(400, "Invalid webhook signature")
    import json as _json
    payload = _json.loads(raw)
    event = payload.get("event")
    entity = (payload.get("payload", {}).get("payment", {}) or {}).get("entity", {}) or {}
    rp_order_id = entity.get("order_id")
    payment_id = entity.get("id")
    if not rp_order_id:
        return {"ok": True}
    if event in ("payment.captured", "order.paid"):
        await db.orders.update_one(
            {"razorpay_order_id": rp_order_id},
            {"$set": {"payment_status": "paid", "razorpay_payment_id": payment_id, "status": "confirmed"}},
        )
    elif event == "payment.failed":
        await db.orders.update_one(
            {"razorpay_order_id": rp_order_id},
            {"$set": {"payment_status": "failed", "payment_failure_reason": entity.get("error_description", "failed")}},
        )
    return {"ok": True}


# ------------ ADMIN ------------
@app.get("/api/admin/stats")
async def admin_stats(admin: dict = Depends(require_roles(Role.admin))):
    today_start = datetime.combine(now().date(), datetime.min.time()).replace(tzinfo=timezone.utc)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    async def revenue(from_dt: datetime):
        pipeline = [
            {"$match": {"created_at": {"$gte": from_dt}, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        ]
        r = await db.orders.aggregate(pipeline).to_list(1)
        return (r[0]["total"] if r else 0, r[0]["count"] if r else 0)

    today_rev, today_count = await revenue(today_start)
    week_rev, week_count = await revenue(week_start)
    month_rev, month_count = await revenue(month_start)

    pending = await db.orders.count_documents({"status": {"$in": ["placed", "confirmed", "preparing", "packed", "out_for_delivery"]}})
    completed = await db.orders.count_documents({"status": "delivered"})
    cancelled = await db.orders.count_documents({"status": "cancelled"})
    customers = await db.users.count_documents({"role": "customer"})
    partners = await db.users.count_documents({"role": "delivery_partner", "is_active": True})
    low_stock = await db.products.count_documents({"stock": {"$lte": 5}, "is_active": True})

    top_pipeline = [
        {"$match": {"is_active": True}},
        {"$sort": {"sold_count": -1}},
        {"$limit": 5},
        {"$project": {"_id": 0, "id": 1, "name": 1, "sold_count": 1, "image_url": 1, "price": 1}},
    ]
    top_products = await db.products.aggregate(top_pipeline).to_list(5)

    return {
        "today_revenue": round(today_rev, 2),
        "today_orders": today_count,
        "week_revenue": round(week_rev, 2),
        "week_orders": week_count,
        "month_revenue": round(month_rev, 2),
        "month_orders": month_count,
        "pending_orders": pending,
        "completed_orders": completed,
        "cancelled_orders": cancelled,
        "total_customers": customers,
        "active_partners": partners,
        "low_stock_products": low_stock,
        "top_products": top_products,
    }


@app.get("/api/admin/orders")
async def admin_orders(admin: dict = Depends(require_roles(Role.admin)), status_filter: Optional[str] = Query(None, alias="status")):
    q = {}
    if status_filter:
        q["status"] = status_filter
    items = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for it in items:
        if isinstance(it.get("created_at"), datetime):
            it["created_at"] = it["created_at"].isoformat()
        out.append(_strip_delivery_otp(it, "admin"))
    return out


@app.get("/api/admin/partners")
async def admin_partners(admin: dict = Depends(require_roles(Role.admin))):
    return await db.users.find({"role": "delivery_partner"}, {"_id": 0, "password_hash": 0}).to_list(200)


class PartnerIn(BaseModel):
    phone: str
    name: str
    is_active: bool = True


@app.post("/api/admin/partners")
async def add_partner(body: PartnerIn, admin: dict = Depends(require_roles(Role.admin))):
    phone = normalize_phone(body.phone)
    existing = await db.users.find_one({"phone": phone, "role": "delivery_partner"})
    if existing:
        raise HTTPException(400, "Partner already exists")
    pid = str(uuid.uuid4())
    await db.users.insert_one(
        {"id": pid, "phone": phone, "name": body.name, "role": "delivery_partner", "is_active": body.is_active, "created_at": now()}
    )
    return {"id": pid}


@app.patch("/api/admin/partners/{partner_id}")
async def toggle_partner(partner_id: str, payload: dict, admin: dict = Depends(require_roles(Role.admin))):
    await db.users.update_one({"id": partner_id, "role": "delivery_partner"}, {"$set": {"is_active": bool(payload.get("is_active"))}})
    return {"ok": True}


@app.get("/api/admin/customers")
async def admin_customers(admin: dict = Depends(require_roles(Role.admin))):
    users = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).to_list(500)
    for u in users:
        u["order_count"] = await db.orders.count_documents({"user_id": u["id"]})
    return users


@app.get("/")
async def root():
    return {"service": "DailyBasics API", "status": "ok"}


# ------------ Startup ------------
@app.on_event("startup")
async def startup():
    await db.users.create_index([("phone", 1), ("role", 1)], sparse=True)
    await db.users.create_index([("email", 1), ("role", 1)], sparse=True)
    await db.otp_challenges.create_index("expires_at", expireAfterSeconds=0)
    await db.products.create_index([("name", 1)])
    await db.products.create_index([("category_id", 1)])
    await db.orders.create_index([("user_id", 1)])
    await db.orders.create_index([("delivery_partner_id", 1)])
    await db.coupon_redemptions.create_index([("user_id", 1), ("code", 1)], unique=True)

    # Startup security warnings
    if DEV_MOCK_OTP:
        logger.warning("SECURITY: DEV_MOCK_OTP=true — OTP codes are returned in API responses. DISABLE before production!")
    if os.environ.get("ADMIN_PASSWORD") in (None, "", "Admin@123", "ChangeMe123!"):
        logger.warning("SECURITY: Admin password is a default/weak value. Change ADMIN_PASSWORD in .env before production!")


@app.on_event("shutdown")
async def shutdown():
    client.close()
