"""Pluggable SMS + WhatsApp providers for DailyBasics.

Set env vars in .env to switch from mock to real providers:
- SMS_PROVIDER: mock | twilio | msg91
- WHATSAPP_PROVIDER: disabled | twilio | meta

All send() calls are safe to await and never crash the caller.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("dailybasics.messaging")

SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "mock").lower()
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_VERIFY_SERVICE_SID = os.environ.get("TWILIO_VERIFY_SERVICE_SID", "")

MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_SENDER_ID = os.environ.get("MSG91_SENDER_ID", "")
MSG91_TEMPLATE_ID = os.environ.get("MSG91_TEMPLATE_ID", "")

WHATSAPP_PROVIDER = os.environ.get("WHATSAPP_PROVIDER", "disabled").lower()
TWILIO_WHATSAPP_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
META_WHATSAPP_TOKEN = os.environ.get("META_WHATSAPP_TOKEN", "")
META_WHATSAPP_PHONE_NUMBER_ID = os.environ.get("META_WHATSAPP_PHONE_NUMBER_ID", "")


def _to_e164_in(phone: str) -> str:
    p = "".join(c for c in phone if c.isdigit())
    if p.startswith("91") and len(p) == 12:
        return f"+{p}"
    return f"+91{p}"


class SmsProvider:
    """Abstraction. `send_otp(phone, code)` returns None on success."""

    async def send_otp(self, phone: str, code: str) -> None:
        raise NotImplementedError


class MockSms(SmsProvider):
    async def send_otp(self, phone: str, code: str) -> None:
        logger.info(f"[MOCK SMS] {phone}: OTP={code}")


class TwilioVerifySms(SmsProvider):
    async def send_otp(self, phone: str, code: str) -> None:
        # Twilio Verify manages OTP generation internally.
        # We still send our own code via SMS API as a plain text — this way
        # the backend stays the source of truth for the OTP (used with our
        # existing HMAC challenge). If you prefer Twilio Verify to generate,
        # use their /Verifications endpoint instead.
        e164 = _to_e164_in(phone)
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        data = {
            "To": e164,
            "From": os.environ.get("TWILIO_SMS_FROM", ""),
            "Body": f"Your DailyBasics OTP is {code}. Valid for 5 minutes.",
        }
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(url, data=data, auth=auth)
        if r.status_code >= 400:
            raise RuntimeError(f"Twilio SMS failed: {r.status_code} {r.text[:200]}")


class Msg91Sms(SmsProvider):
    async def send_otp(self, phone: str, code: str) -> None:
        p = "".join(c for c in phone if c.isdigit())
        if len(p) == 10:
            p = f"91{p}"
        headers = {"authkey": MSG91_AUTH_KEY, "Content-Type": "application/json"}
        payload = {
            "template_id": MSG91_TEMPLATE_ID,
            "sender": MSG91_SENDER_ID,
            "mobiles": p,
            "OTP": code,
            "VAR1": code,
        }
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post("https://control.msg91.com/api/v5/flow/", json=payload, headers=headers)
        if r.status_code >= 400:
            raise RuntimeError(f"MSG91 SMS failed: {r.status_code} {r.text[:200]}")


def get_sms_provider() -> SmsProvider:
    if SMS_PROVIDER == "twilio" and TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        return TwilioVerifySms()
    if SMS_PROVIDER == "msg91" and MSG91_AUTH_KEY and MSG91_TEMPLATE_ID:
        return Msg91Sms()
    return MockSms()


# ----------------- WhatsApp -----------------
class WhatsAppProvider:
    async def send_text(self, phone: str, body: str) -> None:
        raise NotImplementedError


class DisabledWhatsApp(WhatsAppProvider):
    async def send_text(self, phone: str, body: str) -> None:
        logger.info(f"[WA DISABLED] would send to {phone}: {body[:120]}")


class TwilioWhatsApp(WhatsAppProvider):
    async def send_text(self, phone: str, body: str) -> None:
        e164 = _to_e164_in(phone)
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        data = {"To": f"whatsapp:{e164}", "From": TWILIO_WHATSAPP_FROM, "Body": body}
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(url, data=data, auth=auth)
        if r.status_code >= 400:
            raise RuntimeError(f"Twilio WhatsApp failed: {r.status_code} {r.text[:200]}")


class MetaWhatsApp(WhatsAppProvider):
    async def send_text(self, phone: str, body: str) -> None:
        e164 = _to_e164_in(phone).lstrip("+")
        url = f"https://graph.facebook.com/v20.0/{META_WHATSAPP_PHONE_NUMBER_ID}/messages"
        headers = {"Authorization": f"Bearer {META_WHATSAPP_TOKEN}", "Content-Type": "application/json"}
        payload = {
            "messaging_product": "whatsapp",
            "to": e164,
            "type": "text",
            "text": {"body": body},
        }
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(url, json=payload, headers=headers)
        if r.status_code >= 400:
            raise RuntimeError(f"Meta WhatsApp failed: {r.status_code} {r.text[:200]}")


def get_whatsapp_provider() -> WhatsAppProvider:
    if WHATSAPP_PROVIDER == "twilio" and TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        return TwilioWhatsApp()
    if WHATSAPP_PROVIDER == "meta" and META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID:
        return MetaWhatsApp()
    return DisabledWhatsApp()


sms = get_sms_provider()
whatsapp = get_whatsapp_provider()


# Fire-and-forget wrappers used across the codebase
async def send_otp_safe(phone: str, code: str) -> None:
    try:
        await sms.send_otp(phone, code)
    except Exception as e:
        logger.error(f"OTP send failed for {phone}: {e}")


async def send_wa_safe(phone: str, body: str) -> None:
    try:
        await whatsapp.send_text(phone, body)
    except Exception as e:
        logger.error(f"WhatsApp send failed for {phone}: {e}")


# ----------------- Message templates -----------------
def tpl_order_confirmed(name: str, order_number: str, total: float, eta: int) -> str:
    return (
        f"Hi {name or 'there'}! 🛒 Your DailyBasics order #{order_number} for ₹{int(total)} is confirmed. "
        f"Estimated delivery: {eta} min. Track live in the app."
    )


def tpl_out_for_delivery(order_number: str, partner_name: str, partner_phone: str, otp: str) -> str:
    return (
        f"🚴 Your order #{order_number} is out for delivery. "
        f"Partner: {partner_name} ({partner_phone}). Share OTP {otp} at delivery."
    )


def tpl_delivered(order_number: str) -> str:
    return f"✅ Your DailyBasics order #{order_number} was delivered. Please rate your experience in the app!"


def tpl_referral_reward(name: str, amount: int, friend: str) -> str:
    return (
        f"🎉 Hi {name or 'there'}! Your friend {friend} placed their first DailyBasics order. "
        f"You've earned ₹{amount} wallet credit — auto-applied on your next order."
    )
