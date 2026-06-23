from __future__ import annotations

from celery import shared_task
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

User = get_user_model()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_activation_email(self, user_id: int, frontend_url: str) -> None:
    """
    Fetch the user, build a one-time activation link, and send a welcome
    email.  Retried up to 3 times (60-second delay) on transient failures.
    """
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        # The user was deleted between registration and task execution — bail.
        return

    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    activation_link = f"{frontend_url}/verify-email?uid={uidb64}&token={token}"

    if settings.DEBUG:
        print(f"\n{'='*60}")
        print(f"[DEV] Activation link for {user.email}:")
        print(f"  {activation_link}")
        print(f"{'='*60}\n")

    subject = "Activate your CineBook account"
    message = (
        f"Hi {user.username},\n\n"
        "Welcome to CineBook — your go-to platform for booking cinema tickets!\n\n"
        "Please click the link below to activate your account:\n\n"
        f"  {activation_link}\n\n"
        "This link expires after 24 hours. If you did not create an account, "
        "you can safely ignore this email.\n\n"
        "— The CineBook Team"
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email(self, user_id: int, frontend_url: str) -> None:
    """
    Generate a one-time password-reset link and email it to the user.
    Retried up to 3 times (60-second delay) on transient failures.
    """
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    reset_link = f"{frontend_url}/reset-password?uid={uidb64}&token={token}"

    if settings.DEBUG:
        print(f"\n{'='*60}")
        print(f"[DEV] Password reset link for {user.email}:")
        print(f"  {reset_link}")
        print(f"{'='*60}\n")

    subject = "Reset your CineBook password"
    message = (
        f"Hi {user.username},\n\n"
        "We received a request to reset the password for your CineBook account.\n\n"
        "Click the link below to choose a new password:\n\n"
        f"  {reset_link}\n\n"
        "This link expires in 24 hours. If you did not request a password reset, "
        "you can safely ignore this email — your password will not be changed.\n\n"
        "— The CineBook Team"
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc)
