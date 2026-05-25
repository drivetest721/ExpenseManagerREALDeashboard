'''
Purpose : Outbound email helper using aiosmtplib.
          Reads mail credentials from MAIL_* keys in .env via env_config.
          Supports implicit SSL (MAIL_SSL=true, port 465) and STARTTLS
          (MAIL_TLS=true, port 587). Falls back to log-only mode when
          MAIL_SERVER is not configured so dev / test environments work
          without a real mail server.

Inputs  : Recipient email address + message body (subject + plain-text body).

Output  : True on success. Raises RuntimeError on SMTP failure.

Dependencies: aiosmtplib, env_config
'''

import logging
import sys
import os
from email.message import EmailMessage

import aiosmtplib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from env_config import objSettings

objLogger = logging.getLogger(__name__)


async def sendEmail(strToEmail: str, strSubject: str, strBody: str) -> bool:
    """
    Purpose : Send a plain-text email via the MAIL_* SMTP credentials in .env.
              Falls back to log-only when MAIL_SERVER is empty (dev mode).

    Inputs  :   (1) strToEmail : Recipient address (str).
                (2) strSubject : Email subject (str).
                (3) strBody    : Plain-text body (str).

    Output  : True on success. Raises RuntimeError on transport failure.

    Example : await sendEmail("a@b.com", "Verification Code", "Your code: 123456")
    """
    # ── Resolve effective mail settings ──────────────────────────────────────
    strServer   = objSettings.MAIL_SERVER   or objSettings.SMTP_HOST
    iPort       = objSettings.MAIL_PORT     if objSettings.MAIL_SERVER else objSettings.SMTP_PORT
    strUsername = objSettings.MAIL_USERNAME or objSettings.SMTP_USERNAME
    strPassword = objSettings.MAIL_PASSWORD or objSettings.SMTP_PASSWORD
    strFrom     = objSettings.MAIL_FROM     or objSettings.SMTP_FROM
    strFromName = objSettings.MAIL_FROM_NAME
    bUseSSL     = objSettings.MAIL_SSL
    bUseTLS     = objSettings.MAIL_TLS

    if not strServer:
        objLogger.warning(
            f"📭 Mail server not configured — email to {strToEmail} logged only.\n"
            f"   Subject : {strSubject}\n"
            f"   Body    :\n{strBody}"
        )
        return True

    # ── Build "From" header with optional display name ────────────────────────
    strFromHeader = f"{strFromName} <{strFrom}>" if strFromName else strFrom

    objMessage = EmailMessage()
    objMessage["From"]    = strFromHeader
    objMessage["To"]      = strToEmail
    objMessage["Subject"] = strSubject
    objMessage.set_content(strBody)

    objLogger.info(
        f"📤 Sending email | server={strServer}:{iPort} "
        f"ssl={bUseSSL} tls={bUseTLS} → {strToEmail}"
    )

    try:
        if bUseSSL:
            # Implicit SSL — connection is encrypted from the first byte (port 465)
            await aiosmtplib.send(
                objMessage,
                hostname=strServer,
                port=iPort,
                username=strUsername or None,
                password=strPassword or None,
                use_tls=True,
            )
        else:
            # STARTTLS — plain connection upgraded after EHLO (port 587)
            await aiosmtplib.send(
                objMessage,
                hostname=strServer,
                port=iPort,
                username=strUsername or None,
                password=strPassword or None,
                start_tls=bool(bUseTLS),
            )

        objLogger.info(f"✉️  Email sent to {strToEmail} | subject={strSubject}")
        return True

    except Exception as objErr:
        objLogger.error(f"❌ SMTP send failed to {strToEmail}: {objErr}")
        raise RuntimeError(f"Failed to send email: {objErr}")


async def sendVerificationEmail(strToEmail: str, strCode: str, iExpiryMinutes: int = 10) -> bool:
    """
    Purpose : Send the signup verification OTP to a new user's inbox.

    Inputs  :   (1) strToEmail      : Recipient email (str).
                (2) strCode         : 6-digit verification code (str).
                (3) iExpiryMinutes  : Validity window for the code (int).

    Output  : True on success.

    Example : await sendVerificationEmail("a@b.com", "123456")
    """
    strAppName = objSettings.MAIL_FROM_NAME or objSettings.APP_NAME
    strSubject = f"Your {strAppName} verification code"
    strBody = (
        f"Hello,\n\n"
        f"Your verification code is: {strCode}\n\n"
        f"This code will expire in {iExpiryMinutes} minutes.\n"
        f"If you did not request this, you can safely ignore this email.\n\n"
        f"— {strAppName}"
    )
    return await sendEmail(strToEmail, strSubject, strBody)
