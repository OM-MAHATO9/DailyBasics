"""DailyBasics backend integration tests (pytest)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://hyperlocal-commerce-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@dailybasics.in"
ADMIN_PWD = "Admin@123"
CUSTOMER_PHONE = "9999900001"
PARTNER_PHONE = "9888800001"
NEW_PARTNER_PHONE = "9700000042"
GOOD_PIN = "110001"
BAD_PIN = "999999"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _login_otp(s, phone, role):
    r = s.post(f"{API}/auth/otp/request", json={"phone": phone, "role": role})
    assert r.status_code == 200, r.text
    otp = r.json().get("mock_otp")
    assert otp, "mock_otp missing"
    v = s.post(f"{API}/auth/otp/verify", json={"phone": phone, "role": role, "code": otp, "name": "Test"})
    assert v.status_code == 200, v.text
    return v.json()["access_token"], v.json()["user"]


@pytest.fixture(scope="session")
def customer(s):
    tok, user = _login_otp(s, CUSTOMER_PHONE, "customer")
    return {"token": tok, "user": user}


@pytest.fixture(scope="session")
def partner(s):
    tok, user = _login_otp(s, PARTNER_PHONE, "delivery_partner")
    return {"token": tok, "user": user}


# ---------- AUTH ----------
class TestAuth:
    def test_otp_request_returns_mock_otp(self, s):
        r = s.post(f"{API}/auth/otp/request", json={"phone": CUSTOMER_PHONE, "role": "customer"})
        assert r.status_code == 200
        assert "mock_otp" in r.json()
        assert len(r.json()["mock_otp"]) == 6

    def test_otp_verify_creates_session(self, s):
        req = s.post(f"{API}/auth/otp/request", json={"phone": CUSTOMER_PHONE, "role": "customer"})
        code = req.json()["mock_otp"]
        r = s.post(f"{API}/auth/otp/verify", json={"phone": CUSTOMER_PHONE, "role": "customer", "code": code})
        assert r.status_code == 200
        j = r.json()
        assert j["role"] == "customer"
        assert j["access_token"]
        assert j["user"]["phone"] == CUSTOMER_PHONE

    def test_admin_login_valid(self, s):
        r = s.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_admin_login_invalid(self, s):
        r = s.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_new_delivery_partner_signup_rejected(self, s):
        req = s.post(f"{API}/auth/otp/request", json={"phone": NEW_PARTNER_PHONE, "role": "delivery_partner"})
        code = req.json()["mock_otp"]
        r = s.post(f"{API}/auth/otp/verify", json={"phone": NEW_PARTNER_PHONE, "role": "delivery_partner", "code": code, "name": "X"})
        assert r.status_code == 403


# ---------- CATALOG ----------
class TestCatalog:
    def test_categories_19(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 19, f"expected 19 categories, got {len(cats)}"
        sections = {c["section"] for c in cats}
        assert {"food", "essentials", "others"}.issubset(sections)

    def test_products_by_section(self, s):
        r = s.get(f"{API}/products", params={"section": "essentials", "limit": 5})
        assert r.status_code == 200
        assert all(p["section"] == "essentials" for p in r.json())

    def test_products_bestseller_filter(self, s):
        r = s.get(f"{API}/products", params={"bestseller": True})
        assert r.status_code == 200
        assert all(p["is_bestseller"] for p in r.json())

    def test_products_hindi_search(self, s):
        r = s.get(f"{API}/products", params={"q": "आटा"})
        assert r.status_code == 200
        assert len(r.json()) >= 1, "Hindi keyword 'आटा' should match at least one product"

    def test_product_detail(self, s):
        r = s.get(f"{API}/products", params={"limit": 1})
        pid = r.json()[0]["id"]
        d = s.get(f"{API}/products/{pid}")
        assert d.status_code == 200
        assert d.json()["id"] == pid

    def test_product_sort_price_asc(self, s):
        r = s.get(f"{API}/products", params={"sort": "price_asc", "limit": 20})
        prices = [p["price"] for p in r.json()]
        assert prices == sorted(prices)


# ---------- DELIVERY ----------
class TestDelivery:
    def test_check_serviceable(self, s):
        r = s.get(f"{API}/delivery/check/{GOOD_PIN}")
        assert r.status_code == 200
        j = r.json()
        assert j["serviceable"] is True
        assert j["eta_minutes"] >= 1

    def test_check_not_serviceable(self, s):
        r = s.get(f"{API}/delivery/check/{BAD_PIN}")
        assert r.status_code == 200
        assert r.json()["serviceable"] is False


# ---------- COUPONS ----------
class TestCoupons:
    def test_welcome50_valid(self, s, customer):
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(f"{API}/coupons/apply", json={"code": "WELCOME50", "subtotal": 300}, headers=h)
        assert r.status_code == 200
        assert r.json()["discount"] == 50

    def test_welcome50_min_fail(self, s, customer):
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(f"{API}/coupons/apply", json={"code": "WELCOME50", "subtotal": 100}, headers=h)
        assert r.status_code == 400

    def test_invalid_coupon(self, s, customer):
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(f"{API}/coupons/apply", json={"code": "NOPE", "subtotal": 500}, headers=h)
        assert r.status_code == 400


# ---------- ORDER FLOW ----------
class TestOrderFlow:
    order_id = None
    address_id = None
    product_id = None
    initial_stock = None
    quantity = 2
    delivery_otp = None

    def test_create_address(self, s, customer):
        h = {"Authorization": f"Bearer {customer['token']}"}
        payload = {"label": "Home", "house": "TEST H-1", "village": "Test Village", "pincode": GOOD_PIN, "phone": CUSTOMER_PHONE}
        r = s.post(f"{API}/addresses", json=payload, headers=h)
        assert r.status_code == 200
        TestOrderFlow.address_id = r.json()["id"]

    def test_place_order_reduces_stock(self, s, customer):
        # pick a product with enough stock and price so subtotal >= 149 min order
        prods = s.get(f"{API}/products", params={"sort": "price_desc", "limit": 20}).json()
        p = next(x for x in prods if x["stock"] >= 5 and x["price"] * 2 >= 149)
        TestOrderFlow.product_id = p["id"]
        TestOrderFlow.initial_stock = p["stock"]
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = s.post(
            f"{API}/orders",
            json={"address_id": TestOrderFlow.address_id, "items": [{"product_id": p["id"], "quantity": TestOrderFlow.quantity}], "payment_method": "cod"},
            headers=h,
        )
        assert r.status_code == 200, r.text
        o = r.json()
        TestOrderFlow.order_id = o["id"]
        TestOrderFlow.delivery_otp = o["delivery_otp"]
        assert o["status"] == "placed"
        # verify stock decreased
        p2 = s.get(f"{API}/products/{p['id']}").json()
        assert p2["stock"] == TestOrderFlow.initial_stock - TestOrderFlow.quantity

    def test_list_and_get_order(self, s, customer):
        h = {"Authorization": f"Bearer {customer['token']}"}
        lst = s.get(f"{API}/orders", headers=h)
        assert lst.status_code == 200
        assert any(o["id"] == TestOrderFlow.order_id for o in lst.json())
        detail = s.get(f"{API}/orders/{TestOrderFlow.order_id}", headers=h)
        assert detail.status_code == 200
        assert detail.json()["delivery_otp"] == TestOrderFlow.delivery_otp

    def test_admin_assign_partner(self, s, admin_token, partner):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = s.post(
            f"{API}/orders/{TestOrderFlow.order_id}/assign",
            json={"delivery_partner_id": partner["user"]["id"]},
            headers=h,
        )
        assert r.status_code == 200
        o = s.get(f"{API}/orders/{TestOrderFlow.order_id}", headers=h).json()
        assert o["delivery_partner_id"] == partner["user"]["id"]
        assert o["status"] == "confirmed"

    def test_admin_advance_status(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        for st in ["preparing", "packed"]:
            r = s.patch(f"{API}/orders/{TestOrderFlow.order_id}/status", json={"status": st}, headers=h)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == st

    def test_partner_rbac_and_delivery(self, s, partner):
        h = {"Authorization": f"Bearer {partner['token']}"}
        # partner sees the order
        lst = s.get(f"{API}/orders", headers=h).json()
        assert any(o["id"] == TestOrderFlow.order_id for o in lst)
        # advance to out_for_delivery
        r = s.patch(f"{API}/orders/{TestOrderFlow.order_id}/status", json={"status": "out_for_delivery"}, headers=h)
        assert r.status_code == 200
        # wrong OTP fails
        w = s.patch(f"{API}/orders/{TestOrderFlow.order_id}/status", json={"status": "delivered", "otp": "0000"}, headers=h)
        assert w.status_code == 400
        # correct OTP delivers
        ok = s.patch(f"{API}/orders/{TestOrderFlow.order_id}/status", json={"status": "delivered", "otp": TestOrderFlow.delivery_otp, "collected_amount": 200}, headers=h)
        assert ok.status_code == 200
        assert ok.json()["status"] == "delivered"

    def test_delivered_stock_stays_reduced(self, s):
        p2 = s.get(f"{API}/products/{TestOrderFlow.product_id}").json()
        assert p2["stock"] == TestOrderFlow.initial_stock - TestOrderFlow.quantity

    def test_partner_cannot_see_others_orders(self, s, admin_token, customer):
        # Create a new order not assigned to partner
        h_c = {"Authorization": f"Bearer {customer['token']}"}
        prods = s.get(f"{API}/products", params={"limit": 20}).json()
        p = next(x for x in prods if x["stock"] >= 3 and x["price"] * 2 >= 149)
        r = s.post(
            f"{API}/orders",
            json={"address_id": TestOrderFlow.address_id, "items": [{"product_id": p["id"], "quantity": 2}], "payment_method": "cod"},
            headers=h_c,
        )
        oid = r.json()["id"]
        # unassigned partner shouldn't see it in listing
        # login second partner
        req = s.post(f"{API}/auth/otp/request", json={"phone": "9888800002", "role": "delivery_partner"})
        code = req.json()["mock_otp"]
        v = s.post(f"{API}/auth/otp/verify", json={"phone": "9888800002", "role": "delivery_partner", "code": code}).json()
        h_p2 = {"Authorization": f"Bearer {v['access_token']}"}
        lst = s.get(f"{API}/orders", headers=h_p2).json()
        assert not any(o["id"] == oid for o in lst)
        # direct fetch is forbidden
        f = s.get(f"{API}/orders/{oid}", headers=h_p2)
        assert f.status_code == 403
        # cancel it as customer, verify stock restored
        pre = s.get(f"{API}/products/{p['id']}").json()["stock"]
        cx = s.patch(f"{API}/orders/{oid}/status", json={"status": "cancelled"}, headers=h_c)
        assert cx.status_code == 200
        post = s.get(f"{API}/products/{p['id']}").json()["stock"]
        assert post == pre + 2


# ---------- ADMIN STATS ----------
class TestAdminStats:
    def test_admin_stats(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = s.get(f"{API}/admin/stats", headers=h)
        assert r.status_code == 200
        j = r.json()
        for k in ["today_revenue", "today_orders", "pending_orders", "completed_orders", "total_customers", "active_partners", "top_products"]:
            assert k in j
        assert isinstance(j["top_products"], list)

    def test_admin_orders_list(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = s.get(f"{API}/admin/orders", headers=h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
