"""Security fix verification tests (SEC-003, SEC-004, SEC-005, SEC-001)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://hyperlocal-commerce-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@dailybasics.in"
ADMIN_PWD = "Admin@123"
GOOD_PIN = "110001"


def _rand_phone(prefix="99998"):
    # generate never-before-used 10-digit phone (5 fixed + 5 random)
    n = uuid.uuid4().int % 100000
    return f"{prefix}{n:05d}"


def _login_otp(s, phone, role, name="TestUser"):
    r = s.post(f"{API}/auth/otp/request", json={"phone": phone, "role": role})
    assert r.status_code == 200, r.text
    code = r.json().get("mock_otp")
    assert code
    v = s.post(f"{API}/auth/otp/verify", json={"phone": phone, "role": role, "code": code, "name": name})
    assert v.status_code == 200, v.text
    return v.json()["access_token"], v.json()["user"]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer(s):
    phone = _rand_phone("99997")
    tok, u = _login_otp(s, phone, "customer", "SecTest")
    # create address
    h = {"Authorization": f"Bearer {tok}"}
    r = s.post(f"{API}/addresses", json={
        "label": "Home", "house": "TEST SEC-1", "village": "Test", "pincode": GOOD_PIN, "phone": phone
    }, headers=h)
    assert r.status_code == 200, r.text
    return {"token": tok, "user": u, "address_id": r.json()["id"], "phone": phone}


@pytest.fixture(scope="module")
def partner(s):
    tok, u = _login_otp(s, "9888800001", "delivery_partner", "Ramesh")
    return {"token": tok, "user": u}


def _cheap_product(s, qty=2, min_sub=149):
    prods = s.get(f"{API}/products", params={"sort": "price_asc", "limit": 30}).json()
    for p in prods:
        if p["stock"] >= qty and p["price"] * qty >= min_sub:
            return p
    # fallback: pick highest stock
    return next(p for p in prods if p["stock"] >= qty)


# ================== FIX-1: SEC-003 negative/zero/huge quantities ==================
class TestSEC003_Quantity:
    def test_negative_quantity_rejected(self, s, customer):
        p = _cheap_product(s)
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(f"{API}/orders", json={
            "address_id": customer["address_id"],
            "items": [{"product_id": p["id"], "quantity": -5}],
            "payment_method": "cod",
        }, headers=h)
        assert r.status_code in (400, 422), f"expected 400/422, got {r.status_code}: {r.text}"

    def test_zero_quantity_rejected(self, s, customer):
        p = _cheap_product(s)
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(f"{API}/orders", json={
            "address_id": customer["address_id"],
            "items": [{"product_id": p["id"], "quantity": 0}],
            "payment_method": "cod",
        }, headers=h)
        assert r.status_code in (400, 422)

    def test_excess_quantity_rejected(self, s, customer):
        p = _cheap_product(s)
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(f"{API}/orders", json={
            "address_id": customer["address_id"],
            "items": [{"product_id": p["id"], "quantity": 101}],
            "payment_method": "cod",
        }, headers=h)
        assert r.status_code in (400, 422)

    def test_valid_quantity_accepted(self, s, customer):
        # find product where price*1 >= 149
        prods = s.get(f"{API}/products", params={"sort": "price_desc", "limit": 30}).json()
        p = next(x for x in prods if x["stock"] >= 1 and x["price"] >= 149)
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(f"{API}/orders", json={
            "address_id": customer["address_id"],
            "items": [{"product_id": p["id"], "quantity": 1}],
            "payment_method": "cod",
        }, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "placed"


# ================== FIX-2: SEC-004 delivery_otp leak ==================
class TestSEC004_OtpLeak:
    order_id = None
    delivery_otp = None

    def test_setup_place_order_and_assign(self, s, customer, admin_token, partner):
        p = _cheap_product(s, qty=2)
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(f"{API}/orders", json={
            "address_id": customer["address_id"],
            "items": [{"product_id": p["id"], "quantity": 2}],
            "payment_method": "cod",
        }, headers=h)
        assert r.status_code == 200, r.text
        o = r.json()
        TestSEC004_OtpLeak.order_id = o["id"]
        TestSEC004_OtpLeak.delivery_otp = o["delivery_otp"]
        assert o["delivery_otp"], "customer must see delivery_otp at creation"

        # admin assigns partner
        ah = {"Authorization": f"Bearer {admin_token}"}
        r2 = s.post(f"{API}/orders/{o['id']}/assign",
                    json={"delivery_partner_id": partner["user"]["id"]}, headers=ah)
        assert r2.status_code == 200, r2.text

    def test_partner_get_order_no_otp(self, s, partner):
        h = {"Authorization": f"Bearer {partner['token']}"}
        r = s.get(f"{API}/orders/{TestSEC004_OtpLeak.order_id}", headers=h)
        assert r.status_code == 200, r.text
        assert "delivery_otp" not in r.json(), "delivery_otp leaked to delivery partner (GET /orders/{id})"

    def test_partner_list_orders_no_otp(self, s, partner):
        h = {"Authorization": f"Bearer {partner['token']}"}
        r = s.get(f"{API}/orders", headers=h)
        assert r.status_code == 200
        for o in r.json():
            assert "delivery_otp" not in o, f"delivery_otp leaked in list for order {o.get('id')}"

    def test_admin_orders_list_no_otp(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = s.get(f"{API}/admin/orders", headers=h)
        assert r.status_code == 200
        for o in r.json():
            assert "delivery_otp" not in o, f"delivery_otp leaked to admin listing for {o.get('id')}"

    def test_customer_still_sees_otp(self, s, customer):
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.get(f"{API}/orders/{TestSEC004_OtpLeak.order_id}", headers=h)
        assert r.status_code == 200
        assert r.json().get("delivery_otp") == TestSEC004_OtpLeak.delivery_otp

    def test_partner_delivery_wrong_otp_then_correct(self, s, partner, customer):
        h = {"Authorization": f"Bearer {partner['token']}"}
        # first move to out_for_delivery (must pass through preparing/packed via partner? partner can go from confirmed→out_for_delivery per prior tests? keep it simple: try direct)
        # Attempt to deliver with wrong otp
        w = s.patch(f"{API}/orders/{TestSEC004_OtpLeak.order_id}/status",
                    json={"status": "out_for_delivery"}, headers=h)
        # advance ok
        assert w.status_code in (200, 400), w.text
        bad = s.patch(f"{API}/orders/{TestSEC004_OtpLeak.order_id}/status",
                      json={"status": "delivered", "otp": "0000"}, headers=h)
        assert bad.status_code == 400, f"wrong OTP must be rejected: {bad.status_code} {bad.text}"

        # customer fetches otp from their endpoint
        ch = {"Authorization": f"Bearer {customer['token']}"}
        det = s.get(f"{API}/orders/{TestSEC004_OtpLeak.order_id}", headers=ch).json()
        real_otp = det["delivery_otp"]
        assert real_otp == TestSEC004_OtpLeak.delivery_otp

        ok = s.patch(f"{API}/orders/{TestSEC004_OtpLeak.order_id}/status",
                     json={"status": "delivered", "otp": real_otp, "collected_amount": 200}, headers=h)
        assert ok.status_code == 200, ok.text
        body = ok.json()
        assert body["status"] == "delivered"
        assert body.get("payment_status") == "paid"


# ================== FIX-3: SEC-005 coupon reuse ==================
class TestSEC005_Coupon:
    def test_once_per_user_and_cross_user_ok(self, s):
        # fresh customer A
        phone_a = _rand_phone("99996")
        tok_a, ua = _login_otp(s, phone_a, "customer", "A")
        ha = {"Authorization": f"Bearer {tok_a}"}
        addr_a = s.post(f"{API}/addresses", json={
            "label": "Home", "house": "SEC-A", "village": "T", "pincode": GOOD_PIN, "phone": phone_a
        }, headers=ha).json()["id"]

        prods = s.get(f"{API}/products", params={"sort": "price_desc", "limit": 30}).json()
        p = next(x for x in prods if x["stock"] >= 1 and x["price"] >= 299)

        # place order with WELCOME50
        r1 = s.post(f"{API}/orders", json={
            "address_id": addr_a,
            "items": [{"product_id": p["id"], "quantity": 1}],
            "payment_method": "cod",
            "coupon_code": "WELCOME50",
        }, headers=ha)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("coupon_code") == "WELCOME50"
        assert r1.json().get("coupon_discount") == 50

        # apply coupon second time -> 400
        apply2 = s.post(f"{API}/coupons/apply",
                        json={"code": "WELCOME50", "subtotal": 400}, headers=ha)
        assert apply2.status_code == 400, apply2.text
        assert "once" in apply2.text.lower()

        # try to place another order using same coupon -> 400
        r2 = s.post(f"{API}/orders", json={
            "address_id": addr_a,
            "items": [{"product_id": p["id"], "quantity": 1}],
            "payment_method": "cod",
            "coupon_code": "WELCOME50",
        }, headers=ha)
        assert r2.status_code == 400, r2.text

        # different fresh customer B -> can apply
        phone_b = _rand_phone("99995")
        tok_b, ub = _login_otp(s, phone_b, "customer", "B")
        hb = {"Authorization": f"Bearer {tok_b}"}
        apply3 = s.post(f"{API}/coupons/apply",
                        json={"code": "WELCOME50", "subtotal": 400}, headers=hb)
        assert apply3.status_code == 200, apply3.text
        assert apply3.json().get("discount") == 50


# ================== FIX-4: SEC-001 admin credentials still work ==================
class TestSEC001_AdminAuth:
    def test_admin_login_still_valid(self, s):
        r = s.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_admin_login_bad(self, s):
        r = s.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401
