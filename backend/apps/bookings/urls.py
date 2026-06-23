from django.urls import path

from apps.bookings.views import (
    AccountBookedTicketsAPIView,
    ConfirmBookingAPIView,
    HoldSeatsView,
    MoMoIPNAPIView,
    MoMoReturnAPIView,
    PaymentStatusAPIView,
    ReleaseSeatsView,
    VNPayReturnAPIView,
)

urlpatterns = [
    path(
        "me/tickets/",
        AccountBookedTicketsAPIView.as_view(),
        name="account-booked-tickets",
    ),
    path(
        "bookings/confirm/",
        ConfirmBookingAPIView.as_view(),
        name="confirm-booking",
    ),
    path(
        "bookings/payment-status/<str:txn_ref>/",
        PaymentStatusAPIView.as_view(),
        name="payment-status",
    ),
    path(
        "bookings/vnpay-return/",
        VNPayReturnAPIView.as_view(),
        name="vnpay-return",
    ),
    path(
        "bookings/momo-ipn/",
        MoMoIPNAPIView.as_view(),
        name="momo-ipn",
    ),
    path(
        "bookings/momo-return/",
        MoMoReturnAPIView.as_view(),
        name="momo-return",
    ),
    path(
        "bookings/hold/",
        HoldSeatsView.as_view(),
        name="booking-hold",
    ),
    path(
        "bookings/release/",
        ReleaseSeatsView.as_view(),
        name="booking-release",
    ),
]
