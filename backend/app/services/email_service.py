"""Email service — sends transactional emails via SMTP.

If SMTP is not configured (dev mode), the OTP is logged at WARNING level
instead of being sent. The OTP is NEVER logged in production.
"""

import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("aaca")

_SMTP_READY = bool(
    settings.SMTP_HOST
    and settings.SMTP_USERNAME
    and settings.SMTP_PASSWORD
    and settings.SMTP_FROM_EMAIL
)


def _build_reset_message(to_email: str, otp: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Réinitialisation de votre mot de passe PicLearn"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email

    expire_min = settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES
    plain = (
        f"Votre code de vérification est : {otp}\n"
        f"Ce code expire dans {expire_min} minutes.\n"
        "Si vous n'avez pas demandé cette réinitialisation, ignorez cet email."
    )
    html = f"""\
<html><body style="font-family:sans-serif;color:#222;max-width:480px;margin:auto">
  <h2 style="color:#2563EB">Réinitialisation de mot de passe</h2>
  <p>Votre code de vérification est :</p>
  <p style="font-size:2rem;font-weight:bold;letter-spacing:0.25em;color:#1B4FD8">{otp}</p>
  <p>Ce code expire dans <strong>{expire_min} minutes</strong>.</p>
  <hr style="border:none;border-top:1px solid #eee">
  <p style="font-size:.85rem;color:#888">
    Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
  </p>
</body></html>"""

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))
    return msg


def _build_verification_message(to_email: str, otp: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Confirmez votre adresse email — PicLearn"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email

    expire_min = settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES
    plain = (
        f"Bienvenue sur PicLearn !\n"
        f"Votre code de confirmation est : {otp}\n"
        f"Ce code expire dans {expire_min} minutes.\n"
        "Si vous n'avez pas créé de compte, ignorez cet email."
    )
    html = f"""\
<html><body style="font-family:sans-serif;color:#222;max-width:480px;margin:auto">
  <h2 style="color:#2563EB">Bienvenue sur PicLearn 🎓</h2>
  <p>Pour activer votre compte, saisissez ce code de confirmation :</p>
  <p style="font-size:2rem;font-weight:bold;letter-spacing:0.25em;color:#1B4FD8">{otp}</p>
  <p>Ce code expire dans <strong>{expire_min} minutes</strong>.</p>
  <hr style="border:none;border-top:1px solid #eee">
  <p style="font-size:.85rem;color:#888">
    Si vous n'avez pas créé de compte, ignorez cet email.
  </p>
</body></html>"""

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))
    return msg


def _deliver(email: str, msg: MIMEMultipart, kind: str, otp: str) -> bool:
    """Send a prepared message over SMTP.

    Returns True when the email was sent (or logged in dev mode),
    False on SMTP error. Never raises.
    """
    if not _SMTP_READY:
        if settings.DEBUG:
            logger.warning(
                "📧 [DEV] SMTP not configured — OTP for %s: %s", email, otp
            )
        else:
            logger.warning("📧 SMTP not configured — %s email NOT sent to %s", kind, email)
        return True  # treat as success so the flow continues

    try:
        context = ssl.create_default_context()

        if settings.SMTP_USE_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, email, msg.as_string())
        else:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=10) as server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, email, msg.as_string())

        logger.info("📧 %s OTP sent to %s", kind, email)
        return True
    except Exception as exc:
        logger.error("📧 Failed to send %s email to %s: %s", kind, email, exc)
        return False


def send_password_reset_otp(email: str, otp: str) -> bool:
    """Send a password-reset OTP email."""
    return _deliver(email, _build_reset_message(email, otp), "password-reset", otp)


def send_email_verification_otp(email: str, otp: str) -> bool:
    """Send an account email-verification OTP email."""
    return _deliver(email, _build_verification_message(email, otp), "email-verification", otp)
