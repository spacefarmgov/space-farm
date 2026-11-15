"""Outbound SMS and Email notification dispatcher for SpaceFarm agricultural risk alerts."""

from __future__ import annotations

import asyncio
import logging
import re
import smtplib
from email.message import EmailMessage
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger("space_farm.notifier")

SEVERITY_RANK: dict[str, int] = {
    "low": 0,
    "moderate": 1,
    "high": 2,
    "critical": 3,
}


def normalize_e164_phone(phone_code: str | None, phone: str | None) -> str:
    """Normalize stored `(phone_code, phone)` profile fields into clean E.164 format."""
    raw_phone = (phone or "").strip()
    if not raw_phone:
        return ""
    if raw_phone.startswith("+"):
        digits = "+" + re.sub(r"\D", "", raw_phone)
        return digits if len(digits) >= 8 else ""

    code_digits = re.sub(r"\D", "", phone_code or "994") or "994"
    local_digits = re.sub(r"\D", "", raw_phone)
    if local_digits.startswith("0") and len(local_digits) > 6:
        local_digits = local_digits.lstrip("0")
    if not local_digits:
        return ""
    if local_digits.startswith(code_digits) and len(local_digits) >= len(code_digits) + 7:
        return f"+{local_digits}"
    return f"+{code_digits}{local_digits}"


def _send_smtp_sync(
    settings: Settings,
    recipient_email: str,
    subject: str,
    body_text: str,
) -> None:
    msg = EmailMessage()
    msg["From"] = settings.smtp_from_email or settings.smtp_user
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.set_content(body_text)

    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.ehlo()
        if settings.smtp_use_tls:
            server.starttls()
            server.ehlo()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


async def send_email_notification(
    settings: Settings,
    recipient_email: str,
    subject: str,
    body_text: str,
) -> dict[str, str | None]:
    """Send an email via SMTP when configured, or return honest unconfigured queue status."""
    clean_email = (recipient_email or "").strip()
    if not clean_email or "@" not in clean_email:
        return {
            "provider": "none",
            "status": "skipped_no_email",
            "error_detail": "Farmer email address is missing or invalid.",
        }

    if not settings.smtp_host.strip():
        logger.info("Email notification queued in outbox (SMTP_HOST unset) -> %s | %s", clean_email, subject)
        return {
            "provider": "local_outbox_unconfigured",
            "status": "queued_awaiting_credentials",
            "error_detail": "SMTP_HOST / SMTP_USER / SMTP_PASSWORD not set in .env; payload saved to SQLite dispatch outbox.",
        }

    try:
        await asyncio.to_thread(_send_smtp_sync, settings, clean_email, subject, body_text)
        logger.info("Email notification sent via SMTP to %s", clean_email)
        return {"provider": "smtp", "status": "sent", "error_detail": None}
    except Exception as exc:
        logger.warning("SMTP delivery failed for %s: %s", clean_email, exc)
        return {"provider": "smtp", "status": "failed", "error_detail": str(exc)[:300]}


async def send_auth_otp_email(
    settings: Settings,
    recipient_email: str,
    name: str,
    otp_code: str,
) -> dict[str, str | None]:
    """Send 4-digit registration verification code to user's email."""
    clean_name = (name or "Farmer").strip()
    subject = f"SpaceFarm Doğrulama Kodu: {otp_code} / Verification Code"
    body = (
        f"Salam {clean_name},\n\n"
        f"SpaceFarm hesabınızı təsdiqləmək üçün 4 rəqəmli kod: {otp_code}\n"
        "Bu kod 10 dəqiqə ərzində etibarlıdır. Kodu heç kimlə paylaşmayın.\n\n"
        f"---\nHello {clean_name},\n"
        f"Your 4-digit SpaceFarm verification code is: {otp_code}\n"
        "Valid for 10 minutes."
    )
    return await send_email_notification(settings, recipient_email, subject, body)


async def send_password_reset_code_email(
    settings: Settings,
    recipient_email: str,
    name: str,
    reset_code: str,
) -> dict[str, str | None]:
    """Send 6-digit password recovery code to user's email."""
    clean_name = (name or "Farmer").strip()
    subject = f"SpaceFarm Şifrə Bərpa Kodu: {reset_code} / Password Reset"
    body = (
        f"Salam {clean_name},\n\n"
        f"SpaceFarm şifrənizi yeniləmək üçün 6 rəqəmli bərpa kodu: {reset_code}\n"
        "Bu kod 15 dəqiqə ərzində etibarlıdır. Əgər bu sorğunu siz göndərməmisinizsə, məktubu nəzərə almayın.\n\n"
        f"---\nHello {clean_name},\n"
        f"Your 6-digit SpaceFarm password reset code is: {reset_code}\n"
        "Valid for 15 minutes."
    )
    return await send_email_notification(settings, recipient_email, subject, body)


async def send_sms_notification(
    settings: Settings,
    phone_e164: str,
    message_text: str,
) -> dict[str, str | None]:
    """Dispatch SMS via Twilio / custom webhook when configured, or record honest outbox status."""
    if not phone_e164:
        return {
            "provider": "none",
            "status": "skipped_no_phone",
            "error_detail": "No phone number configured in farmer profile (/profile).",
        }

    has_twilio = bool(
        settings.twilio_account_sid.strip()
        and settings.twilio_auth_token.strip()
        and settings.twilio_from_number.strip()
    )
    if settings.sms_provider == "twilio" or has_twilio:
        if not has_twilio:
            return {
                "provider": "twilio",
                "status": "failed",
                "error_detail": "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER is missing.",
            }
        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    url,
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                    data={
                        "From": settings.twilio_from_number,
                        "To": phone_e164,
                        "Body": message_text[:1500],
                    },
                )
            if 200 <= resp.status_code < 300:
                logger.info("SMS notification sent via Twilio to %s", phone_e164)
                return {"provider": "twilio", "status": "sent", "error_detail": None}
            return {
                "provider": "twilio",
                "status": "failed",
                "error_detail": f"Twilio HTTP {resp.status_code}: {resp.text[:200]}",
            }
        except Exception as exc:
            logger.warning("Twilio SMS request failed for %s: %s", phone_e164, exc)
            return {"provider": "twilio", "status": "failed", "error_detail": str(exc)[:300]}

    if settings.sms_provider == "webhook" or settings.sms_webhook_url.strip():
        webhook_url = settings.sms_webhook_url.strip()
        if not webhook_url:
            return {
                "provider": "sms_webhook",
                "status": "failed",
                "error_detail": "SMS_WEBHOOK_URL is not configured.",
            }
        headers = {"Content-Type": "application/json"}
        if settings.sms_webhook_token.strip():
            headers["Authorization"] = f"Bearer {settings.sms_webhook_token.strip()}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    webhook_url,
                    headers=headers,
                    json={"to": phone_e164, "message": message_text[:1500]},
                )
            if 200 <= resp.status_code < 300:
                logger.info("SMS notification sent via webhook to %s", phone_e164)
                return {"provider": "sms_webhook", "status": "sent", "error_detail": None}
            return {
                "provider": "sms_webhook",
                "status": "failed",
                "error_detail": f"Webhook HTTP {resp.status_code}: {resp.text[:200]}",
            }
        except Exception as exc:
            logger.warning("SMS webhook failed for %s: %s", phone_e164, exc)
            return {"provider": "sms_webhook", "status": "failed", "error_detail": str(exc)[:300]}

    logger.info("SMS notification queued in outbox (SMS provider unset) -> %s", phone_e164)
    return {
        "provider": "local_outbox_unconfigured",
        "status": "queued_awaiting_credentials",
        "error_detail": "TWILIO_* or SMS_WEBHOOK_URL not configured in .env; SMS payload saved to SQLite dispatch outbox.",
    }


async def dispatch_alert_notifications(
    *,
    store: Any,
    settings: Settings,
    user: dict[str, Any],
    alert_record: dict[str, Any],
    prefs: dict[str, Any],
    force: bool = False,
) -> list[dict[str, Any]]:
    """Evaluate preferences & dispatch SMS + Email notifications for an alert."""
    sev = str(alert_record.get("severity", "moderate")).lower()
    min_sev = str(prefs.get("min_severity", "high")).lower()
    if not force and SEVERITY_RANK.get(sev, 0) < SEVERITY_RANK.get(min_sev, 2):
        return []

    alert_id = alert_record.get("id")
    parcel_label = alert_record.get("parcel_label", "Field")
    title_az = alert_record.get("title_az", "")
    msg_az = alert_record.get("message_az", "")
    trigger_metric = alert_record.get("trigger_metric", "")
    lat = alert_record.get("latitude")
    lon = alert_record.get("longitude")
    coord_str = f"{lat:.2f}°N, {lon:.2f}°E" if (lat is not None and lon is not None) else ""

    sms_body = (
        f"[SpaceFarm {sev.upper()}] {parcel_label} ({coord_str}): "
        f"{title_az} — {trigger_metric}. {msg_az}"
    )[:480]
    email_subject = f"[SpaceFarm Erkən Xəbərdarlıq · {sev.upper()}] {parcel_label}: {title_az}"
    email_body = (
        f"Hörmətli {user.get('name', 'Fermer')},\n\n"
        f"Sahə: {parcel_label} ({coord_str})\n"
        f"Risk səviyyəsi: {sev.upper()}\n"
        f"Xəbərdarlıq: {title_az}\n"
        f"Ölçülən göstərici: {trigger_metric}\n\n"
        f"Təfərrüat və tövsiyə:\n{msg_az}\n\n"
        f"— SpaceFarm Erkən Xəbərdarlıq Sistemi (CODE44)"
    )

    dispatches: list[dict[str, Any]] = []
    phone_e164 = normalize_e164_phone(user.get("phone_code"), user.get("phone"))
    email_addr = str(user.get("email") or "").strip()

    tasks: list[tuple[str, str, str, str, Any]] = []
    if prefs.get("email_enabled", True):
        tasks.append(
            (
                "email",
                email_addr or "unset",
                email_subject,
                email_body,
                send_email_notification(settings, email_addr, email_subject, email_body),
            )
        )
    if prefs.get("sms_enabled", True):
        tasks.append(
            (
                "sms",
                phone_e164 or "unset",
                title_az,
                sms_body,
                send_sms_notification(settings, phone_e164, sms_body),
            )
        )

    if not tasks:
        return []

    results = await asyncio.gather(*(t[4] for t in tasks))
    for (channel, recipient, subject, body, _), res in zip(tasks, results):
        row = store.record_dispatch(
            user_id=user["id"],
            alert_id=alert_id,
            channel=channel,
            recipient=recipient,
            subject=subject,
            body=body,
            provider=res["provider"] or "outbox",
            status=res["status"] or "queued_awaiting_credentials",
            error_detail=res.get("error_detail"),
        )
        dispatches.append(row)

    return dispatches
