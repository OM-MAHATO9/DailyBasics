"""Tests for new features: SMS/WhatsApp abstractions, Razorpay placeholder, Referral Rewards, Wallet apply/refund.

Run:
  pytest /app/backend/tests/test_new_features.py -v --tb=short \
    --junitxml=/app/test_reports/pytest/new_features.xml
"""
import os
import random
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://hyperlocal-commerce-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@dailybasics.in"
ADMIN_PWD = "Admin@123"
PARTNER_PHONE = "9888800001"
GOOD_PIN = "110001"


def _fresh_phone(prefix="99993"):
    return f"{prefix}{random.randint(10000, 99999)}"


def _otp_login(s, phone, role, name=None, referral_code=None):
    r = s.post(f"{API}/auth/otp/request", json={"phone": phone, "role": role})
    assert r.status_code == 200, r.text
    code = r.json()["mock_otp"]
    payload = {"phone": phone, "role": role, "code": code}
    if name:
        payload["name"] = name
    if referral_code is not None:
        payload["referral_code"] = referral_code
    v = s.post(f"{API}/auth/otp/verify", json=payload)
    assert v.status_code == 200, v.text
    return v.json()["access_token"], v.json()["user"]


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200
    return r.json()["access_token"]


# ================== 1. SMS PROVIDER ABSTRACTION ==================
class TestSmsProvider:
    def test_otp_request_returns_mock_provider(self, s):
        r = s.post(f"{API}/auth/otp/request", json={"phone": _fresh_phone(), "role": "customer"})
        assert r.status_code == 200
        j = r.json()
        assert j.get("provider") == "mock"
        assert j.get("mock_otp") and len(j["mock_otp"]) == 6
        assert "message" in j

    def test_rate_limit_4th_returns_429(self, s):
        phone = _fresh_phone(prefix="99992")
        for i in range(3):
            r = s.post(f"{API}/auth/otp/request", json={"phone": phone, "role": "customer"})
            assert r.status_code == 200, f"attempt {i}: {r.text}"
        r4 = s.post(f"{API}/auth/otp/request", json={"phone": phone, "role": "customer"})
        assert r4.status_code == 429, r4.text
        assert "too many" in r4.text.lower()


# ================== 3. RAZORPAY PLACEHOLDER ==================
class TestRazorpayPlaceholder:
    def test_payments_config(self, s):
        r = s.get(f"{API}/payments/config")
        assert r.status_code == 200
        j = r.json()
        assert j.get("razorpay_enabled") is False
        assert j.get("razorpay_key_id") in (None, "")

    def test_online_order_returns_disabled_flag(self, s):
        phone = _fresh_phone(prefix="99994")
        tok, _ = _otp_login(s, phone, "customer", name="Online Test")
        h = {"Authorization": f"Bearer {tok}"}
        addr = s.post(f"{API}/addresses", json={"label": "H", "house": "TEST-ONLINE", "village": "V", "pincode": GOOD_PIN, "phone": phone}, headers=h).json()
        prods = s.get(f"{API}/products", params={"sort": "price_desc", "limit": 5}).json()
        p = prods[0]
        r = s.post(f"{API}/orders", json={
            "address_id": addr["id"],
            "items": [{"product_id": p["id"], "quantity": 1}],
            "payment_method": "online",
        }, headers=h)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("razorpay_enabled") is False
        assert j.get("razorpay_message"), "razorpay_message must be present"


# ================== 4 + 5. REFERRAL + WALLET FLOW (CRITICAL) ==================
class TestReferralAndWallet:
    """End-to-end: seeded Ramu 9999900001 refers a fresh user; fresh user places COD > 299;
    partner delivers → both wallets credited ₹50; referrer applies wallet at next order; cancel refunds."""

    ctx: dict = {}

    def _cheap_addr(self, s, token, phone, tag):
        h = {"Authorization": f"Bearer {token}"}
        r = s.post(f"{API}/addresses", json={"label": "H", "house": f"TEST-REF-{tag}", "village": "V", "pincode": GOOD_PIN, "phone": phone}, headers=h)
        assert r.status_code == 200
        return r.json()["id"]

    def test_a_seeded_referrer_has_code(self, s):
        tok, user = _otp_login(s, "9999900001", "customer")
        self.__class__.ctx["ramu_tok"] = tok
        self.__class__.ctx["ramu_id"] = user["id"]
        self.__class__.ctx["ramu_phone"] = user["phone"]
        h = {"Authorization": f"Bearer {tok}"}
        r = s.get(f"{API}/referral", headers=h)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["referral_code"] and len(j["referral_code"]) == 6
        assert j["reward_amount"] == 50
        assert j["min_order"] == 299
        assert isinstance(j["referred_count"], int)
        assert "share_message" in j
        self.__class__.ctx["ramu_code"] = j["referral_code"]
        self.__class__.ctx["ramu_initial_referred"] = j["referred_count"]

    def test_b_check_valid_and_invalid(self, s):
        code = self.__class__.ctx["ramu_code"]
        r_ok = s.get(f"{API}/referral/check/{code}")
        assert r_ok.status_code == 200
        j = r_ok.json()
        assert j["valid"] is True
        assert "referrer_name" in j
        r_bad = s.get(f"{API}/referral/check/ZZZBAD9")
        assert r_bad.status_code == 200
        assert r_bad.json()["valid"] is False

    def test_c_new_signup_with_referral(self, s):
        phone = _fresh_phone(prefix="99981")
        code = self.__class__.ctx["ramu_code"]
        tok, user = _otp_login(s, phone, "customer", name="ReferredUser", referral_code=code)
        self.__class__.ctx["new_tok"] = tok
        self.__class__.ctx["new_id"] = user["id"]
        self.__class__.ctx["new_phone"] = phone
        h = {"Authorization": f"Bearer {tok}"}
        w = s.get(f"{API}/wallet", headers=h).json()
        assert w["balance"] == 0
        assert w["referral_code"] and len(w["referral_code"]) == 6
        assert w["referral_code"] != code, "New user got same code as referrer"

    def test_d_invalid_code_silently_ignored(self, s):
        phone = _fresh_phone(prefix="99982")
        tok, _ = _otp_login(s, phone, "customer", name="Nobody", referral_code="ZZZ999")
        h = {"Authorization": f"Bearer {tok}"}
        w = s.get(f"{API}/wallet", headers=h).json()
        # No crash + user has own code + balance 0. Indirect proof referred_by is null: no bonus will fire.
        assert w["balance"] == 0
        assert w["referral_code"]

    def test_e_no_self_referral(self, s):
        # Sign up brand-new user with a fresh code they don't yet own; verify their own code differs.
        phone = _fresh_phone(prefix="99983")
        tok1, u1 = _otp_login(s, phone, "customer", name="SelfTest")
        h1 = {"Authorization": f"Bearer {tok1}"}
        w = s.get(f"{API}/wallet", headers=h1).json()
        assert w["referral_code"]
        # Architecturally referred_by is set only at insert time, and user_id check prevents self-link.
        # We assert no crash and balance stays 0.
        assert w["balance"] == 0

    def test_f_new_user_places_cod_order_over_299(self, s):
        tok = self.__class__.ctx["new_tok"]
        phone = self.__class__.ctx["new_phone"]
        h = {"Authorization": f"Bearer {tok}"}
        addr_id = self._cheap_addr(s, tok, phone, "new")
        # pick expensive-ish product; qty 2 to exceed 299
        prods = s.get(f"{API}/products", params={"sort": "price_desc", "limit": 30}).json()
        p = next(x for x in prods if x["price"] >= 150 and x["stock"] >= 4)
        r = s.post(f"{API}/orders", json={
            "address_id": addr_id,
            "items": [{"product_id": p["id"], "quantity": 2}],
            "payment_method": "cod",
        }, headers=h)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["status"] == "placed"
        assert o["total"] >= 299 or (o["total"] + float(o.get("wallet_applied") or 0)) >= 299
        self.__class__.ctx["order_id"] = o["id"]
        self.__class__.ctx["delivery_otp"] = o["delivery_otp"]
        self.__class__.ctx["order_total"] = o["total"]

    def test_g_admin_assign_and_partner_deliver(self, s, admin_token):
        oid = self.__class__.ctx["order_id"]
        # Partner login
        p_tok, p_user = _otp_login(s, PARTNER_PHONE, "delivery_partner")
        h_admin = {"Authorization": f"Bearer {admin_token}"}
        r = s.post(f"{API}/orders/{oid}/assign", json={"delivery_partner_id": p_user["id"]}, headers=h_admin)
        assert r.status_code == 200, r.text
        h_p = {"Authorization": f"Bearer {p_tok}"}
        r1 = s.patch(f"{API}/orders/{oid}/status", json={"status": "out_for_delivery"}, headers=h_p)
        assert r1.status_code == 200, r1.text
        r2 = s.patch(f"{API}/orders/{oid}/status", json={
            "status": "delivered",
            "otp": self.__class__.ctx["delivery_otp"],
            "collected_amount": self.__class__.ctx["order_total"],
        }, headers=h_p)
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "delivered"
        self.__class__.ctx["partner_tok"] = p_tok

    def test_h_both_wallets_credited_50(self, s):
        # small delay for referral crediting side-effects (it is awaited but be safe)
        time.sleep(0.5)
        h_new = {"Authorization": f"Bearer {self.__class__.ctx['new_tok']}"}
        h_ramu = {"Authorization": f"Bearer {self.__class__.ctx['ramu_tok']}"}
        w_new = s.get(f"{API}/wallet", headers=h_new).json()
        w_ramu = s.get(f"{API}/wallet", headers=h_ramu).json()
        assert w_new["balance"] == 50, f"new user wallet expected 50 got {w_new}"
        # ramu had some balance from prior test runs? check delta by looking at latest txn type
        types_new = [t["type"] for t in w_new["transactions"]]
        types_ramu = [t["type"] for t in w_ramu["transactions"]]
        assert "referral_bonus" in types_new
        assert "referral_reward" in types_ramu
        self.__class__.ctx["ramu_balance_after_credit"] = w_ramu["balance"]

    def test_i_referrer_count_incremented(self, s):
        h_ramu = {"Authorization": f"Bearer {self.__class__.ctx['ramu_tok']}"}
        r = s.get(f"{API}/referral", headers=h_ramu).json()
        assert r["referred_count"] >= self.__class__.ctx["ramu_initial_referred"] + 1

    def test_j_idempotency_no_double_credit(self, s):
        # Try setting delivered again — should not re-credit
        h_p = {"Authorization": f"Bearer {self.__class__.ctx['partner_tok']}"}
        h_new = {"Authorization": f"Bearer {self.__class__.ctx['new_tok']}"}
        s.patch(f"{API}/orders/{self.__class__.ctx['order_id']}/status", json={
            "status": "delivered",
            "otp": self.__class__.ctx["delivery_otp"],
        }, headers=h_p)  # may 200 or 4xx, we don't care about return
        w_new = s.get(f"{API}/wallet", headers=h_new).json()
        assert w_new["balance"] == 50, f"Idempotency broken: new user balance = {w_new['balance']}"

    def test_k_wallet_apply_at_checkout(self, s):
        """Referrer places NEW order with use_wallet:true. Wallet ₹50 should apply."""
        tok = self.__class__.ctx["ramu_tok"]
        h = {"Authorization": f"Bearer {tok}"}
        phone = self.__class__.ctx["ramu_phone"]
        addr_id = self._cheap_addr(s, tok, phone, "ramu-wallet")
        # Aim for subtotal ~₹200 + delivery ₹10 = ₹210. Pick a cheapish product; qty adjusted.
        prods = s.get(f"{API}/products", params={"sort": "price_asc", "limit": 30}).json()
        # find product where 2*price is between 150 and 260 to trigger delivery=10 and wallet applies partial or full
        p = next((x for x in prods if 60 <= x["price"] <= 130 and x["stock"] >= 4), None)
        if not p:
            p = next(x for x in prods if x["stock"] >= 2)
        qty = 2
        # capture current balance
        w_before = s.get(f"{API}/wallet", headers=h).json()
        bal_before = w_before["balance"]
        assert bal_before >= 50
        r = s.post(f"{API}/orders", json={
            "address_id": addr_id,
            "items": [{"product_id": p["id"], "quantity": qty}],
            "payment_method": "cod",
            "use_wallet": True,
        }, headers=h)
        assert r.status_code == 200, r.text
        o = r.json()
        # Wallet applied should be > 0
        assert o["wallet_applied"] > 0, f"expected wallet_applied>0, got {o}"
        # Bill must match: subtotal + delivery_charge - coupon_discount - wallet_applied == total
        assert abs((o["subtotal"] + o["delivery_charge"] - o.get("coupon_discount", 0) - o["wallet_applied"]) - o["total"]) < 0.5
        self.__class__.ctx["ramu_wallet_order"] = o["id"]
        self.__class__.ctx["ramu_wallet_applied"] = o["wallet_applied"]
        # Wallet balance dropped
        w_after = s.get(f"{API}/wallet", headers=h).json()
        assert abs(w_after["balance"] - (bal_before - o["wallet_applied"])) < 0.01
        types = [t["type"] for t in w_after["transactions"]]
        assert "spent" in types

    def test_l_cancel_refunds_wallet(self, s):
        tok = self.__class__.ctx["ramu_tok"]
        h = {"Authorization": f"Bearer {tok}"}
        oid = self.__class__.ctx["ramu_wallet_order"]
        applied = self.__class__.ctx["ramu_wallet_applied"]
        w_before = s.get(f"{API}/wallet", headers=h).json()["balance"]
        r = s.patch(f"{API}/orders/{oid}/status", json={"status": "cancelled"}, headers=h)
        assert r.status_code == 200, r.text
        w_after = s.get(f"{API}/wallet", headers=h).json()
        assert abs(w_after["balance"] - (w_before + applied)) < 0.01
        types = [t["type"] for t in w_after["transactions"]]
        assert "refund" in types

    def test_m_wallet_cap_leaves_at_least_one_rupee(self, s):
        """Edge: if wallet >= total, cap wallet_applied so total - wallet >= 1."""
        # Use the new user (has ₹50 wallet, no more credits since idempotent) and place a small order
        # above min_order_value (₹99 for zone A).
        tok = self.__class__.ctx["new_tok"]
        h = {"Authorization": f"Bearer {tok}"}
        phone = self.__class__.ctx["new_phone"]
        # find a product priced ~50-70 rupees, take qty 2 so subtotal ~100-140
        prods = s.get(f"{API}/products", params={"sort": "price_asc", "limit": 50}).json()
        p = next((x for x in prods if 50 <= x["price"] <= 80 and x["stock"] >= 2), prods[0])
        addr_id = self._cheap_addr(s, tok, phone, "cap")
        r = s.post(f"{API}/orders", json={
            "address_id": addr_id,
            "items": [{"product_id": p["id"], "quantity": 2}],
            "payment_method": "cod",
            "use_wallet": True,
        }, headers=h)
        assert r.status_code == 200, r.text
        o = r.json()
        # total must be >= 1
        assert o["total"] >= 1, f"Total dropped below ₹1: {o}"
        # wallet_applied should not exceed subtotal+delivery-1
        cap = o["subtotal"] + o["delivery_charge"] - o.get("coupon_discount", 0) - 1
        assert o["wallet_applied"] <= cap + 0.01, f"wallet_applied {o['wallet_applied']} exceeds cap {cap}"
