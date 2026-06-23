from django.urls import path

from .views import (
    AvatarUploadView,
    ChangePasswordView,
    DeactivateAccountView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    MePointHistoryAPIView,
    MeTicketsAPIView,
    MeView,
    PointBalanceAPIView,
    PointCalculateAPIView,
    PointRedeemAPIView,
    PointRedemptionConfigAPIView,
    PointTransactionHistoryAPIView,
    RefreshTokenView,
    RegisterView,
    ResetPasswordConfirmView,
    VerifyEmailView,
    MeRemindersAPIView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path(
        "reset-password-confirm/",
        ResetPasswordConfirmView.as_view(),
        name="reset-password-confirm",
    ),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("me/avatar/", AvatarUploadView.as_view(), name="me-avatar"),
    path("me/points/", MePointHistoryAPIView.as_view(), name="me-points"),
    path("me/tickets/", MeTicketsAPIView.as_view(), name="me-tickets"),
    path("me/reminders/", MeRemindersAPIView.as_view(), name="me-reminders"),
    path("me/delete/", DeactivateAccountView.as_view(), name="me-delete"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),

    # Points discount system
    path("points/config/", PointRedemptionConfigAPIView.as_view(), name="points-config"),
    path("points/balance/", PointBalanceAPIView.as_view(), name="points-balance"),
    path("points/calculate/", PointCalculateAPIView.as_view(), name="points-calculate"),
    path("points/redeem/", PointRedeemAPIView.as_view(), name="points-redeem"),
    path("points/history/", PointTransactionHistoryAPIView.as_view(), name="points-history"),
]
