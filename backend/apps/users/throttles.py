from rest_framework.throttling import AnonRateThrottle


class EmailActionThrottle(AnonRateThrottle):
    """
    Applied to unauthenticated endpoints that dispatch outbound email
    (registration, forgot-password).

    Rate is resolved from REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['email_action']
    in settings.py, defaulting to 5 requests per hour per source IP.
    This prevents both email-infrastructure abuse and account-enumeration attacks.
    """

    scope = "email_action"


class LoginThrottle(AnonRateThrottle):
    scope = "login"
