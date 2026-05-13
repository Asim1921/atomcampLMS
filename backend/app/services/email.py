"""SMTP email helper. Configure Gmail with an App Password (smtp.gmail.com:587)."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)
_last_error: str | None = None


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password and settings.smtp_from)


def smtp_last_error() -> str | None:
    return _last_error


def smtp_configuration_hint() -> str:
    """Human-readable hint when SMTP is incomplete (no secrets)."""
    missing: list[str] = []
    if not (settings.smtp_host or "").strip():
        missing.append("SMTP_HOST")
    if not (settings.smtp_user or "").strip():
        missing.append("SMTP_USER")
    if not (settings.smtp_password or "").strip():
        missing.append("SMTP_PASSWORD")
    if not (settings.smtp_from or "").strip():
        missing.append("SMTP_FROM")
    acct = (settings.smtp_user or "your Gmail address").strip()
    if missing:
        return (
            f"Password reset email is not configured: {', '.join(missing)} "
            f"is empty in the repo root .env file. For Gmail, create an App Password at "
            f"https://myaccount.google.com/apppasswords for {acct}, put it in SMTP_PASSWORD "
            "(same account as SMTP_USER), save .env, and restart the API server (uvicorn)."
        )
    return (
        "SMTP is incomplete. In the repo root .env set SMTP_HOST, SMTP_USER, SMTP_PASSWORD (16-char Gmail App Password), "
        "and SMTP_FROM, then restart the API so it reloads the file."
    )


def send_email(*, to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Send a mail via SMTP. Returns True on success, False (silently) if not configured."""

    global _last_error
    _last_error = None

    if not smtp_configured():
        _last_error = "SMTP is not configured."
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from}>"
    msg["To"] = to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.ehlo()
            if settings.smtp_use_tls:
                smtp.starttls()
                smtp.ehlo()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except smtplib.SMTPAuthenticationError as e:
        _last_error = (
            "Gmail rejected the SMTP username/app password. Generate a new Gmail App Password "
            "for this account and update SMTP_PASSWORD in .env."
        )
        logger.warning("SMTP auth failed for user=%s to=%s: %s", settings.smtp_user, to, e)
        return False
    except (smtplib.SMTPException, OSError) as e:
        _last_error = str(e)
        logger.warning("SMTP send failed for to=%s: %s", to, e, exc_info=True)
        return False


def render_otp_email(name: str, code: str, ttl_minutes: int) -> tuple[str, str]:
    """Formal password-reset email containing a 6-digit OTP."""

    salutation = f"Dear {name}," if name else "Dear learner,"

    text = (
        f"{salutation}\n\n"
        f"We received a request to reset the password associated with your AtomCamp LMS account. "
        f"To proceed, please use the verification code below on the password reset page.\n\n"
        f"    Verification code: {code}\n"
        f"    Validity: {ttl_minutes} minutes from the time this email was sent.\n\n"
        f"For your security, do not share this code with anyone. AtomCamp LMS staff will never "
        f"ask for this code by phone, email, or chat.\n\n"
        f"If you did not request a password reset, no further action is required — your password "
        f"will remain unchanged, and you may safely disregard this email.\n\n"
        f"Should you need any assistance, please reply to this email and a member of the team will "
        f"be happy to help.\n\n"
        f"Sincerely,\n"
        f"The AtomCamp LMS Team\n"
    )

    html = f"""<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:36px 12px;background:#f4f7fb">
      <tr><td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
               style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(15,23,42,0.18)">
          <tr><td style="background:linear-gradient(90deg,#0f766e,#0e7490);padding:22px 32px;color:#ffffff">
            <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.85">AtomCamp LMS</p>
            <h1 style="margin:6px 0 0 0;font-size:22px;font-weight:600">Password reset verification</h1>
          </td></tr>
          <tr><td style="padding:28px 32px 4px 32px">
            <p style="margin:0 0 14px 0;font-size:15px;color:#111827">{salutation}</p>
            <p style="margin:0 0 18px 0;font-size:14px;line-height:1.65;color:#374151">
              We received a request to reset the password associated with your <strong>AtomCamp LMS</strong> account.
              Please use the verification code below on the password reset page to complete the request.
            </p>
            <div style="margin:24px 0 8px 0;padding:18px 22px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;text-align:center">
              <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280">Verification code</p>
              <p style="margin:0;font-size:32px;letter-spacing:0.4em;font-weight:700;color:#0f172a;font-family:'SF Mono',Consolas,Menlo,monospace">{code}</p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#6b7280">Valid for {ttl_minutes} minutes from the time this email was sent.</p>
            </div>
            <p style="margin:18px 0 0 0;font-size:13px;line-height:1.65;color:#4b5563">
              For your security, please do not share this code with anyone. Members of the AtomCamp LMS team
              will never ask you for this code by phone, email, or chat.
            </p>
            <p style="margin:14px 0 0 0;font-size:13px;line-height:1.65;color:#4b5563">
              If you did not initiate this request, no further action is required — your password will remain
              unchanged, and you may safely disregard this email.
            </p>
          </td></tr>
          <tr><td style="padding:18px 32px 26px 32px">
            <p style="margin:0;font-size:14px;color:#111827">Sincerely,</p>
            <p style="margin:2px 0 0 0;font-size:14px;color:#111827;font-weight:600">The AtomCamp LMS Team</p>
          </td></tr>
          <tr><td style="padding:14px 32px 22px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center">
              This is a transactional message from AtomCamp LMS. Please do not reply unless you require assistance.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
    return text, html


# Backward-compat name in case anything else imports it.
def render_reset_email(name: str, reset_link: str, code: str) -> tuple[str, str]:
    _ = reset_link
    return render_otp_email(name, code, 15)
