from __future__ import annotations

import hashlib
import hmac
import logging
import urllib.parse
import uuid
from datetime import timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import requests as http_requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.cinemas.models import SeatHold, Showtime
from apps.cinemas.serializers import (
    VALID_SEAT_TYPES,
    ConfirmBookingSerializer,
    HoldSeatsSerializer,
)
from apps.promotions.models import MoviePromotion
from apps.promotions.services import calculate_discount_amount
from apps.users.models import UserProfile
from apps.users.services import award_points_for_booking

from .models import Booking, Payment, Ticket
from .serializers import BookedTicketSerializer
from .services import (
    SEAT_HOLD_TTL,
    SeatAlreadyHeldException,
    SessionExpiredException,
)
from .services import (
    clear_session as redis_clear_session,
)
from .services import (
    hold_seats as redis_hold_seats,
)
from .services import (
    release_all_seats_for_user as redis_release_all,
)
from .services import (
    release_seats as redis_release_seats,
)

logger = logging.getLogger(__name__)

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

SEAT_PRICES: dict[str, Decimal] = {
    "normal": Decimal("75000"),
    "vip": Decimal("120000"),
    "couple": Decimal("180000"),
}


# ── VNPay helpers ─────────────────────────────────────────────────────────


def _client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return (
        xff.split(",")[0].strip()
        if xff
        else request.META.get("REMOTE_ADDR", "127.0.0.1")
    )


def _vnpay_sign(data: dict, secret: str) -> str:
    query = "&".join(
        f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in sorted(data.items())
    )
    return hmac.new(secret.encode(), query.encode(), hashlib.sha512).hexdigest()


def _build_vnpay_url(request, payment: Payment, booking: Booking) -> str:
    now_vn = timezone.now().astimezone(VN_TZ)
    expire_vn = now_vn + timedelta(minutes=15)

    params = {
        "vnp_Version": "2.1.0",
        "vnp_Command": "pay",
        "vnp_TmnCode": settings.VNPAY_TMN_CODE,
        "vnp_Amount": str(payment.amount * 100),
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": payment.txn_ref,
        "vnp_OrderInfo": f"CineBook booking {booking.booking_code}",
        "vnp_OrderType": "other",
        "vnp_Locale": "vn",
        "vnp_ReturnUrl": settings.VNPAY_RETURN_URL,
        "vnp_IpAddr": _client_ip(request),
        "vnp_CreateDate": now_vn.strftime("%Y%m%d%H%M%S"),
        "vnp_ExpireDate": expire_vn.strftime("%Y%m%d%H%M%S"),
    }
    params["vnp_SecureHash"] = _vnpay_sign(params, settings.VNPAY_HASH_SECRET_KEY)
    return f"https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?{urllib.parse.urlencode(params)}"


# ── MoMo helpers ──────────────────────────────────────────────────────────


def _momo_sign(raw_data: str) -> str:
    return hmac.new(
        settings.MOMO_SECRET_KEY.encode(), raw_data.encode(), hashlib.sha256
    ).hexdigest()


def _build_momo_url(payment: Payment, booking: Booking) -> str | None:
    request_id = str(uuid.uuid4())
    order_id = payment.txn_ref
    order_info = f"CineBook booking {booking.booking_code}"
    amount = str(payment.amount)
    extra_data = ""

    raw_signature = (
        f"accessKey={settings.MOMO_ACCESS_KEY}"
        f"&amount={amount}"
        f"&extraData={extra_data}"
        f"&ipnUrl={settings.MOMO_IPN_URL}"
        f"&orderId={order_id}"
        f"&orderInfo={order_info}"
        # f"&orderExpireTime=15"
        f"&partnerCode={settings.MOMO_PARTNER_CODE}"
        f"&redirectUrl={settings.MOMO_RETURN_URL}"
        f"&requestId={request_id}"
        f"&requestType=payWithMethod"
    )
    signature = _momo_sign(raw_signature)

    payload = {
        "partnerCode": settings.MOMO_PARTNER_CODE,
        "accessKey": settings.MOMO_ACCESS_KEY,
        "requestId": request_id,
        "amount": amount,
        "orderId": order_id,
        "orderInfo": order_info,
        "redirectUrl": settings.MOMO_RETURN_URL,
        "ipnUrl": settings.MOMO_IPN_URL,
        "extraData": extra_data,
        "requestType": "payWithMethod",
        "signature": signature,
        "lang": "vi",
        "orderExpireTime": 15,
        "expireTime": 15,
    }

    try:
        resp = http_requests.post(
            settings.MOMO_ENDPOINT, json=payload, timeout=15, verify=False
        )

        logger.error("Momo status: %s", resp.status_code)
        logger.error("Momo resp: %s", resp.text)

        data = resp.json()
        if data.get("resultCode") == 0:
            return data.get("payUrl")
        logger.error(
            "Momo res: %s | message: %s", data.get("resultCode"), data.get("message")
        )
        return None
    except Exception as e:
        logger.error("Momo exception: %s", e)
        return None


# ── Views ─────────────────────────────────────────────────────────────────


class AccountBookedTicketsAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile

        bookings = (
            Booking.objects.filter(user_profile_id=profile, is_deleted=False)
            .prefetch_related("tickets__showtime__cinema_room")
            .order_by("-created_at")
        )

        serializer = BookedTicketSerializer(
            bookings, many=True, context={"request": request}
        )
        return Response(serializer.data)


class ConfirmBookingAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = ConfirmBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        showtime = (
            Showtime.objects.select_related("cinema_room")
            .filter(
                pk=d["showtime_id"],
                is_deleted=False,
                status="confirmed",
            )
            .first()
        )
        if not showtime:
            return Response(
                {"detail": "Showtime not found or not confirmed."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if showtime.start_time < timezone.now():
            return Response(
                {
                    "detail": "Cannot confirm booking for a showtime that has already started."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        seat_labels = d["seat_labels"]
        flat_price_promotion_id = d.get("flat_price_promotion_id")
        points_to_redeem = d.get("points_to_redeem", 0) or 0
        concessions_total = Decimal(str(d.get("concession_amount", 0) or 0))
        payment_method = d.get("payment_method", "vnpay")
        if payment_method not in ("vnpay", "momo"):
            payment_method = "vnpay"

        user = request.user
        profile = getattr(user, "profile", None)
        if profile is None:
            profile = UserProfile.objects.create(
                user=user,
                full_name=user.get_full_name() or user.username,
                phone_number="",
                gender="other",
            )

        active_holds = set(
            SeatHold.objects.filter(
                showtime=showtime,
                user=user,
                expires_at__gt=timezone.now(),
            ).values_list("seat_label", flat=True)
        )
        missing = [lbl for lbl in seat_labels if lbl not in active_holds]
        if missing:
            return Response(
                {
                    "detail": f"Seat holds expired or missing: {', '.join(missing)}. Please select seats again."
                },
                status=status.HTTP_409_CONFLICT,
            )

        existing = set(
            Ticket.objects.filter(
                showtime=showtime,
                seat_label__in=seat_labels,
                is_deleted=False,
                ticket_status_snapshot__in=["active", "used"],
            ).values_list("seat_label", flat=True)
        )
        if existing:
            return Response(
                {"detail": f"Seats already booked: {', '.join(existing)}"},
                status=status.HTTP_409_CONFLICT,
            )

        seat_map = {
            f"{s['row']}{s['number']}": s for s in (showtime.cinema_room.seat_map or [])
        }

        # Optional flat price promotion application.
        # The user asked to keep this simple: only enforce is_active + scope matching here.
        flat_price = None
        flat_applies_to = None
        if flat_price_promotion_id:
            try:
                from apps.promotions.models import FlatPricePromotion

                promo = FlatPricePromotion.objects.select_related("cinema_version").get(
                    pk=int(flat_price_promotion_id)
                )
                if promo.is_active:
                    # version scope (if set)
                    if (
                        promo.cinema_version_id is None
                        or promo.cinema_version_id == showtime.version_id_id
                    ):
                        if promo.seat_scope == FlatPricePromotion.SeatScope.ALL:
                            flat_applies_to = {"normal", "vip", "couple"}
                        else:
                            flat_applies_to = {promo.seat_scope}
                        flat_price = Decimal(str(promo.flat_price))
            except Exception:
                flat_price = None
                flat_applies_to = None

        total = Decimal("0")
        ticket_data = []
        for lbl in seat_labels:
            seat_info = seat_map.get(lbl, {})
            raw_type = seat_info.get("type", "normal").lower()
            seat_type = raw_type if raw_type in VALID_SEAT_TYPES else "normal"
            if (
                flat_price is not None
                and flat_applies_to
                and seat_type in flat_applies_to
            ):
                price = flat_price
            else:
                price = SEAT_PRICES.get(seat_type, Decimal("75000"))
            total += price
            ticket_data.append(
                {
                    "seat_label": lbl,
                    "seat_type": seat_type,
                    "price": price,
                }
            )

        concessions_input = request.data.get("concessions", [])
        concessions_total_price = Decimal("0")
        concession_line_items = []
        if concessions_input:
            from apps.concessions.models import ConcessionVariant

            v_ids = [c.get("id") for c in concessions_input if c.get("id")]
            # Fetch variants, ensuring both the variant and its parent concession are active
            variants_db = {
                v.id: v
                for v in ConcessionVariant.objects.select_related("concession").filter(
                    id__in=v_ids,
                    is_active=True,
                    concession__is_active=True,
                )
            }

            for c_item in concessions_input:
                v_obj = variants_db.get(c_item.get("id"))
                if v_obj:
                    qty = int(c_item.get("quantity", 1))
                    unit_price = v_obj.base_price
                    line_total = unit_price * qty

                    concessions_total_price += line_total
                    total += line_total
                    concession_line_items.append(
                        {
                            "variant": v_obj,
                            "display_name": f"{v_obj.concession.name} - {v_obj.name}",
                            "quantity": qty,
                            "unit_price": unit_price,
                            "line_total": line_total,
                        }
                    )

        # Calculate flat-price discount amount (if promotion was applied)
        flat_discount = Decimal("0")
        if flat_price is not None and flat_applies_to:
            original_total = Decimal("0")
            for lbl in seat_labels:
                seat_info = seat_map.get(lbl, {})
                raw_t = seat_info.get("type", "normal").lower()
                st = raw_t if raw_t in VALID_SEAT_TYPES else "normal"
                original_total += SEAT_PRICES.get(st, Decimal("75000"))
            flat_discount = max(Decimal("0"), original_total - total)

        # Point redemption
        points_discount_vnd = Decimal("0")
        if points_to_redeem > 0:
            from apps.users.services import _get_config, calculate_redeemable_points

            config = _get_config()
            if config and config.is_active:
                calc = calculate_redeemable_points(
                    user,
                    int(total),
                    int(flat_discount),
                )
                if not calc["is_redemption_available"]:
                    return Response(
                        {"detail": "Point redemption is not available."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if points_to_redeem > calc["redeemable_points"]:
                    return Response(
                        {
                            "detail": f"Cannot redeem {points_to_redeem} pts. Max: {calc['redeemable_points']} pts."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                points_discount_vnd = Decimal(
                    str(points_to_redeem * config.points_per_vnd)
                )
        promo_code = d.get("promo_code")
        movie_id_input = d.get("movie_id")
        promo_discount_vnd = Decimal("0")

        if promo_code:
            today = timezone.now().date()
            try:
                promotion = MoviePromotion.objects.get(code=promo_code)
                # Only check date + movie scope — NOT usage_limit
                # (usage was already atomically consumed by PromotionRedeemAPIView)
                date_ok = promotion.start_date <= today <= promotion.end_date
                movie_ok = (
                    promotion.movie_id is None or promotion.movie_id == movie_id_input
                )
                if date_ok and movie_ok:
                    promo_discount_vnd = calculate_discount_amount(promotion, total)
                else:
                    return Response(
                        {
                            "detail": "Promo code is expired or not valid for this movie."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except MoviePromotion.DoesNotExist:
                return Response(
                    {"detail": "Promo code not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # discount_amount = flat_discount + points_discount_vnd + promo_discount_vnd
        # # discounts apply only to tickets
        # # concessions are added after discounts
        # # final_amount = max(
        # #     Decimal("0"), total - points_discount_vnd + promo_discount_vnd
        # # )
        # final_amount = max(0, total - discount_amount)

        # ticket_total = total
        # discounted_ticket_total = max(Decimal("0"), ticket_total - discount_amount)
        # grand_total = discounted_ticket_total + concessions_total

        ticket_total = total  # already includes flat-price seat values
        non_flat_discount_amount = points_discount_vnd + promo_discount_vnd
        discount_amount = flat_discount + non_flat_discount_amount  # reporting only
        discounted_ticket_total = max(
            Decimal("0"), ticket_total - non_flat_discount_amount
        )
        grand_total = discounted_ticket_total + concessions_total

        booking_code = f"BK-{uuid.uuid4().hex[:10].upper()}"
        booking = Booking.objects.create(
            booking_code=booking_code,
            user_profile_id=profile,
            customer_name=profile.full_name,
            customer_email=user.email,
            customer_phone=profile.phone_number,
            total_amount=ticket_total + concessions_total,
            discount_amount=discount_amount,
            final_amount=grand_total,
            points_used=points_to_redeem,
            points_earned=0,  # will be set after payment confirmation
            status="pending",
            payment_method=payment_method,
        )

        # Actually deduct points if redemption was requested
        if points_to_redeem > 0:
            from apps.users.services import redeem_points as do_redeem

            try:
                do_redeem(
                    user,
                    booking,
                    points_to_redeem,
                    int(total),
                    int(flat_discount),
                    skip_booking_update=True,
                )
            except ValueError as e:
                booking.delete()
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if concession_line_items:
            from apps.concessions.models import ConcessionItem, ConcessionOrder

            concession_order = ConcessionOrder.objects.create(
                user=user,
                booking=booking,
                order_code=f"CONC-{uuid.uuid4().hex[:8].upper()}",
                sales_channel="WEB",
                order_total=Decimal("0"),
            )

            order_items = [
                ConcessionItem(
                    order=concession_order,
                    variant=item["variant"],
                    display_name=item["display_name"],
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    line_total=item["line_total"],
                )
                for item in concession_line_items
            ]

            if order_items:
                ConcessionItem.objects.bulk_create(order_items)
                concession_order.order_total = concessions_total_price
                concession_order.save(update_fields=["order_total"])
            else:
                concession_order.delete()

        # Clear stale pending/cancelled tickets to prevent UniqueConstraint error.
        # Since this user legally holds the SeatHold right now, any existing non-active
        # tickets for these seats are guaranteed to be from expired/abandoned sessions.
        Ticket.objects.filter(showtime=showtime, seat_label__in=seat_labels).exclude(
            ticket_status_snapshot__in=["active", "used"]
        ).delete()

        tickets = [
            Ticket(
                booking=booking,
                showtime=showtime,
                seat_label=td["seat_label"],
                price=td["price"],
                seat_type_snapshot=td["seat_type"],
                ticket_status_snapshot="pending",
            )
            for td in ticket_data
        ]
        Ticket.objects.bulk_create(tickets)

        txn_ref = f"PAY-{uuid.uuid4().hex[:14].upper()}"
        payment = Payment.objects.create(
            booking=booking,
            txn_ref=txn_ref,
            gateway=payment_method,
            amount=int(grand_total),
            status="pending",
        )

        if payment_method == "momo":
            payment_url = _build_momo_url(payment, booking)
        else:
            payment_url = _build_vnpay_url(request, payment, booking)

        if not payment_url:
            return Response(
                {"detail": "Failed to create payment URL. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # DO NOT delete holds. Extend them by 15 mins (900s) for payment
        try:
            from apps.bookings.services import _get_redis_client, _seat_key

            client = _get_redis_client()
            for lbl in seat_labels:
                key = _seat_key(showtime.pk, lbl)
                if client.get(key) == str(user.id):
                    client.expire(key, 900)

            SeatHold.objects.filter(showtime=showtime, user=user).update(
                expires_at=timezone.now() + timedelta(minutes=15)
            )
            redis_clear_session(user.id, showtime.pk)
        except Exception as e:
            logger.error("Failed to extend hold during payment: %s", e)

        from apps.users.models import PointRedemptionConfig

        seat_base_amount = Decimal("0")
        for lbl in seat_labels:
            seat_info = seat_map.get(lbl, {})
            raw_type = seat_info.get("type", "normal").lower()
            seat_type = raw_type if raw_type in VALID_SEAT_TYPES else "normal"
            seat_base_amount += SEAT_PRICES.get(seat_type, Decimal("75000"))

        config = PointRedemptionConfig.objects.first()

        ratio_earned = (
            Decimal(str(config.ratio_earned))
            if config and getattr(config, "ratio_earned", None) is not None
            else Decimal("0.1")
        )

        points_per_vnd = (
            Decimal(str(config.points_per_vnd))
            if config and getattr(config, "points_per_vnd", None) is not None
            else Decimal("1000")
        )

        base_amount_for_points = seat_base_amount + concessions_total_price
        points_earned = 0

        # Only award points if there's an earning ratio, no other discounts applied, and no points redeemed
        if ratio_earned > 0 and discount_amount == 0 and points_to_redeem == 0:
            points_earned = int(
                (base_amount_for_points / points_per_vnd) * ratio_earned
            )

        return Response(
            {
                "bookingId": booking.booking_code,
                "movieTitle": showtime.movie.title if showtime.movie else "",
                "start_time": timezone.localtime(showtime.start_time).strftime(
                    "%Y-%m-%d %H:%M"
                ),
                "end_time": timezone.localtime(showtime.end_time).strftime(
                    "%Y-%m-%d %H:%M"
                ),
                "purchase_time": timezone.localtime(booking.created_at).strftime(
                    "%Y-%m-%d %H:%M"
                )
                if booking.created_at
                else "",
                "hall": showtime.cinema_room.name,
                "seats": [td["seat_label"] for td in ticket_data],
                "totalAmount": int(ticket_total + concessions_total),
                "finalAmount": int(grand_total),
                "discountAmount": int(discount_amount),
                "pointsUsed": points_to_redeem,
                "pointsEarned": points_earned,
                "paymentUrl": payment_url,
                "paymentMethod": payment_method,
                "txnRef": txn_ref,
            },
            status=status.HTTP_201_CREATED,
        )


class PaymentStatusAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, txn_ref):
        payment = (
            Payment.objects.filter(txn_ref=txn_ref).select_related("booking").first()
        )
        if not payment:
            return Response(
                {"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            {
                "txnRef": payment.txn_ref,
                "status": payment.status,
                "gateway": payment.gateway,
                "amount": payment.amount,
                "bookingCode": payment.booking.booking_code,
                "bookingStatus": payment.booking.status,
            }
        )


class VNPayReturnAPIView(APIView):
    """VNPay redirects the user's browser here after payment."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        params = dict(request.query_params)
        secure_hash = params.pop("vnp_SecureHash", [""])[0]

        flat = {k: (v[0] if isinstance(v, list) else v) for k, v in params.items()}
        flat.pop("vnp_SecureHashType", None)

        expected = _vnpay_sign(flat, settings.VNPAY_HASH_SECRET_KEY)
        txn_ref = flat.get("vnp_TxnRef", "")

        payment = (
            Payment.objects.filter(txn_ref=txn_ref).select_related("booking").first()
        )

        if payment and secure_hash == expected:
            response_code = flat.get("vnp_ResponseCode", "99")
            payment.gateway_response_code = response_code
            payment.gateway_txn_id = flat.get("vnp_TransactionNo", "")
            if response_code == "00":
                payment.status = "success"
                payment.booking.status = "confirmed"
                payment.booking.save(update_fields=["status", "updated_at"])
                # Activate tickets and remove holds since seats are now permanently sold
                Ticket.objects.filter(booking=payment.booking).update(
                    ticket_status_snapshot="active"
                )
                tickets = Ticket.objects.filter(booking=payment.booking)
                if tickets.exists():
                    showtime_id = tickets.first().showtime_id
                    seat_labels = list(tickets.values_list("seat_label", flat=True))
                    from apps.bookings.services import broadcast_seat_update

                    broadcast_seat_update(showtime_id, "book", seat_labels)
                booked_seats = Ticket.objects.filter(
                    booking=payment.booking
                ).values_list("seat_label", flat=True)
                SeatHold.objects.filter(
                    user=payment.booking.user_profile_id.user,
                    seat_label__in=booked_seats,
                ).delete()
                try:
                    award_points_for_booking(payment.booking)
                except Exception as exc:
                    logger.error(
                        "Failed to award points for booking %s: %s",
                        payment.booking.booking_code,
                        exc,
                    )
            else:
                payment.status = "failed"
                payment.booking.status = "cancelled"
                payment.booking.save(update_fields=["status", "updated_at"])
                # Cancel pending tickets and instantly release seats for others
                # Hard delete the pending tickets so the seat can be rebooked immediately
                tickets = Ticket.objects.filter(booking=payment.booking)
                if tickets.exists():
                    showtime_id = tickets.first().showtime_id
                    seat_labels = list(tickets.values_list("seat_label", flat=True))

                    # 1. Delete SeatHolds
                    SeatHold.objects.filter(
                        user=payment.booking.user_profile_id.user,
                        seat_label__in=seat_labels,
                    ).delete()

                    # 2. Hard delete pending tickets
                    tickets.delete()

                    # 3. Broadcast release to the WebSocket
                    from apps.bookings.services import broadcast_seat_update

                    broadcast_seat_update(showtime_id, "release", seat_labels)

                try:
                    from apps.bookings.services import _get_redis_client, _seat_key

                    client = _get_redis_client()
                    user_id = payment.booking.user_profile_id.user.id
                    for seat_label in seat_labels if "seat_labels" in locals() else []:
                        key = _seat_key(showtime_id, seat_label)
                        if client.get(key) == str(user_id):
                            client.delete(key)
                except Exception as e:
                    logger.error("Redis unlock failed on cancel: %s", e)
            payment.save(
                update_fields=[
                    "status",
                    "gateway_response_code",
                    "gateway_txn_id",
                    "updated_at",
                ]
            )

        frontend = settings.FRONTEND_URL.rstrip("/")
        redirect_url = f"{frontend}/booking?payment_callback=vnpay&txn_ref={txn_ref}"

        from django.shortcuts import redirect as django_redirect

        return django_redirect(redirect_url)


class MoMoIPNAPIView(APIView):
    """MoMo server-to-server IPN (Instant Payment Notification)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        order_id = data.get("orderId", "")
        result_code = data.get("resultCode")
        momo_txn_id = data.get("transId", "")

        raw_signature = (
            f"accessKey={settings.MOMO_ACCESS_KEY}"
            f"&amount={data.get('amount', '')}"
            f"&extraData={data.get('extraData', '')}"
            f"&message={data.get('message', '')}"
            f"&orderId={order_id}"
            f"&orderInfo={data.get('orderInfo', '')}"
            f"&orderType={data.get('orderType', '')}"
            f"&partnerCode={data.get('partnerCode', '')}"
            f"&payType={data.get('payType', '')}"
            f"&requestId={data.get('requestId', '')}"
            f"&responseTime={data.get('responseTime', '')}"
            f"&resultCode={result_code}"
            f"&transId={momo_txn_id}"
        )
        expected_sig = _momo_sign(raw_signature)
        received_sig = data.get("signature", "")

        if expected_sig != received_sig:
            return Response({"resultCode": 1, "message": "Invalid signature"})

        payment = (
            Payment.objects.filter(txn_ref=order_id).select_related("booking").first()
        )
        if not payment:
            return Response({"resultCode": 1, "message": "Order not found"})

        payment.gateway_txn_id = str(momo_txn_id)
        payment.gateway_response_code = str(result_code)

        if result_code == 0:
            payment.status = "success"
            payment.booking.status = "confirmed"
            payment.booking.save(update_fields=["status", "updated_at"])
            # Activate tickets and remove holds since seats are now permanently sold
            Ticket.objects.filter(booking=payment.booking).update(
                ticket_status_snapshot="active"
            )
            tickets = Ticket.objects.filter(booking=payment.booking)
            if tickets.exists():
                showtime_id = tickets.first().showtime_id
                seat_labels = list(tickets.values_list("seat_label", flat=True))
                from apps.bookings.services import broadcast_seat_update

                broadcast_seat_update(showtime_id, "book", seat_labels)
            booked_seats = Ticket.objects.filter(booking=payment.booking).values_list(
                "seat_label", flat=True
            )
            SeatHold.objects.filter(
                user=payment.booking.user_profile_id.user,
                seat_label__in=booked_seats,
            ).delete()
            try:
                award_points_for_booking(payment.booking)
            except Exception as exc:
                logger.error(
                    "Failed to award points for booking %s: %s",
                    payment.booking.booking_code,
                    exc,
                )
        else:
            payment.status = "failed"
            payment.booking.status = "cancelled"
            payment.booking.save(update_fields=["status", "updated_at"])
            # Cancel pending tickets and instantly release seats for others
            # Hard delete the pending tickets so the seat can be rebooked immediately
            tickets = Ticket.objects.filter(booking=payment.booking)
            if tickets.exists():
                showtime_id = tickets.first().showtime_id
                seat_labels = list(tickets.values_list("seat_label", flat=True))

                # 1. Delete SeatHolds
                SeatHold.objects.filter(
                    user=payment.booking.user_profile_id.user,
                    seat_label__in=seat_labels,
                ).delete()

                # 2. Hard delete pending tickets
                tickets.delete()

                # 3. Broadcast release to the WebSocket
                from apps.bookings.services import broadcast_seat_update

                broadcast_seat_update(showtime_id, "release", seat_labels)

            try:
                from apps.bookings.services import _get_redis_client, _seat_key

                client = _get_redis_client()
                user_id = payment.booking.user_profile_id.user.id
                for seat_label in seat_labels if "seat_labels" in locals() else []:
                    key = _seat_key(showtime_id, seat_label)
                    if client.get(key) == str(user_id):
                        client.delete(key)
            except Exception as e:
                logger.error("Redis unlock failed on cancel: %s", e)

        payment.save(
            update_fields=[
                "status",
                "gateway_response_code",
                "gateway_txn_id",
                "updated_at",
            ]
        )
        return Response({"resultCode": 0, "message": "OK"})


class MoMoReturnAPIView(APIView):
    """MoMo redirects the user's browser here (via redirectUrl) — just checks status."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        order_id = request.query_params.get("orderId", "")
        result_code = request.query_params.get("resultCode", "99")

        payment = (
            Payment.objects.filter(txn_ref=order_id).select_related("booking").first()
        )
        if payment and payment.status == "pending":
            payment.gateway_response_code = str(result_code)
            if str(result_code) == "0":
                payment.status = "success"
                payment.booking.status = "confirmed"
                payment.booking.save(update_fields=["status", "updated_at"])
                # Activate tickets and remove holds since seats are now permanently sold
                Ticket.objects.filter(booking=payment.booking).update(
                    ticket_status_snapshot="active"
                )
                tickets = Ticket.objects.filter(booking=payment.booking)
                if tickets.exists():
                    showtime_id = tickets.first().showtime_id
                    seat_labels = list(tickets.values_list("seat_label", flat=True))
                    from apps.bookings.services import broadcast_seat_update

                    broadcast_seat_update(showtime_id, "book", seat_labels)
                booked_seats = Ticket.objects.filter(
                    booking=payment.booking
                ).values_list("seat_label", flat=True)
                SeatHold.objects.filter(
                    user=payment.booking.user_profile_id.user,
                    seat_label__in=booked_seats,
                ).delete()
                try:
                    award_points_for_booking(payment.booking)
                except Exception as exc:
                    logger.error(
                        "Failed to award points for booking %s: %s",
                        payment.booking.booking_code,
                        exc,
                    )
            else:
                payment.status = "failed"
                payment.booking.status = "cancelled"
                payment.booking.save(update_fields=["status", "updated_at"])
                # Cancel pending tickets and instantly release seats for others
                # Hard delete the pending tickets so the seat can be rebooked immediately
                tickets = Ticket.objects.filter(booking=payment.booking)
                if tickets.exists():
                    showtime_id = tickets.first().showtime_id
                    seat_labels = list(tickets.values_list("seat_label", flat=True))

                    # 1. Delete SeatHolds
                    SeatHold.objects.filter(
                        user=payment.booking.user_profile_id.user,
                        seat_label__in=seat_labels,
                    ).delete()

                    # 2. Hard delete pending tickets
                    tickets.delete()

                    # 3. Broadcast release to the WebSocket
                    from apps.bookings.services import broadcast_seat_update

                    broadcast_seat_update(showtime_id, "release", seat_labels)

                try:
                    from apps.bookings.services import _get_redis_client, _seat_key

                    client = _get_redis_client()
                    user_id = payment.booking.user_profile_id.user.id
                    for seat_label in seat_labels if "seat_labels" in locals() else []:
                        key = _seat_key(showtime_id, seat_label)
                        if client.get(key) == str(user_id):
                            client.delete(key)
                except Exception as e:
                    logger.error("Redis unlock failed on cancel: %s", e)
            payment.save(
                update_fields=["status", "gateway_response_code", "updated_at"]
            )

        frontend = settings.FRONTEND_URL.rstrip("/")
        redirect_url = f"{frontend}/booking?payment_callback=momo&txn_ref={order_id}"
        from django.shortcuts import redirect as django_redirect

        return django_redirect(redirect_url)


class HoldSeatsView(APIView):
    """
    POST /api/bookings/hold/

    Acquire a 5-minute seat hold for a set of seats on a showtime.

    Strategy — dual-write for consistency:
      1. Validates seats exist and are not already SOLD (DB Ticket check).
      2. Acquires Redis locks atomically (SETNX per seat, all-or-nothing rollback).
      3. Writes SeatHold rows to DB so ConfirmBookingAPIView can still validate.

    If any seat is held by another user, returns 409 with conflicting labels.
    On success returns the list of held labels and an ISO-8601 expires_at
    timestamp so the frontend can display a countdown timer.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Bookings"],
        summary="Hold seats (Redis + DB)",
        description=(
            "Atomically acquire a 5-minute hold on one or more seats for a showtime. "
            "Returns 409 if any seat is already held by another user."
        ),
        responses={
            200: OpenApiResponse(description="Seats held successfully."),
            400: OpenApiResponse(description="Invalid seat labels or showtime."),
            409: OpenApiResponse(description="One or more seats already held."),
        },
    )
    def post(self, request):
        serializer = HoldSeatsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        seat_labels: list[str] = serializer.validated_data["seat_labels"]
        showtime_id: int | None = request.data.get("showtime_id")

        if not showtime_id:
            return Response(
                {"detail": "'showtime_id' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Fetch showtime ────────────────────────────────────────────
        showtime = (
            Showtime.objects.select_related("cinema_room")
            .filter(pk=showtime_id, is_deleted=False, status="confirmed")
            .first()
        )
        if not showtime:
            return Response(
                {"detail": "Showtime not found or not confirmed."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if showtime.start_time < timezone.now():
            return Response(
                {
                    "detail": "Cannot book seats for a showtime that has already started."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        seat_map: dict[str, dict] = {
            f"{s['row']}{s['number']}": s for s in (showtime.cinema_room.seat_map or [])
        }

        # ── Validate labels exist in the room ─────────────────────────
        invalid = [lbl for lbl in seat_labels if lbl not in seat_map]
        if invalid:
            return Response(
                {"detail": f"Invalid seat labels: {', '.join(invalid)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Check already SOLD in DB (final, irrevocable state) ───────
        sold = set(
            Ticket.objects.filter(
                showtime=showtime,
                seat_label__in=seat_labels,
                is_deleted=False,
                ticket_status_snapshot__in=["active", "used"],
            ).values_list("seat_label", flat=True)
        )
        if sold:
            return Response(
                {"detail": f"Seats already sold: {', '.join(sorted(sold))}"},
                status=status.HTTP_409_CONFLICT,
            )

        # [BUG 1 FIX] Release unselected seats from Redis before acquiring new ones
        user_current_holds = list(
            SeatHold.objects.filter(showtime=showtime, user=request.user).values_list(
                "seat_label", flat=True
            )
        )
        seats_to_release = [
            seat for seat in user_current_holds if seat not in seat_labels
        ]
        if seats_to_release:
            try:
                redis_release_seats(showtime.pk, seats_to_release, request.user.id)
                from apps.bookings.services import release_seats as db_release_seats

                db_release_seats(showtime.pk, seats_to_release, request.user.id)
                logger.info(
                    "Released unselected seats for user %s: %s",
                    request.user.id,
                    seats_to_release,
                )

                from apps.bookings.services import broadcast_seat_update

                broadcast_seat_update(showtime.pk, "release", seats_to_release)
            except Exception as e:
                logger.error("Failed to release unselected seats: %s", e)

        # ── Acquire Redis locks (atomic, all-or-nothing) ──────────────
        effective_ttl = SEAT_HOLD_TTL  # fallback if Redis is down
        try:
            effective_ttl = redis_hold_seats(
                showtime.pk,
                seat_labels,
                request.user.id,
            )
        except SessionExpiredException:
            return Response(
                {
                    "detail": (
                        "Your 15-minute booking window has expired. "
                        "Please start a new seat selection."
                    ),
                },
                status=status.HTTP_408_REQUEST_TIMEOUT,
            )
        except SeatAlreadyHeldException as exc:
            return Response(
                {
                    "detail": "One or more selected seats are no longer available.",
                    "conflicting_seats": exc.conflicting_seats,
                },
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as exc:
            logger.warning("Redis hold failed, falling back to DB-only: %s", exc)

        # ── Write DB SeatHold (dual-write for ConfirmBookingAPIView) ──
        expires_at = timezone.now() + timedelta(seconds=effective_ttl)
        try:
            with transaction.atomic():
                # Replace all existing holds by this user for this showtime
                SeatHold.objects.filter(showtime=showtime, user=request.user).delete()

                SeatHold.objects.bulk_create(
                    [
                        SeatHold(
                            showtime=showtime,
                            seat_label=lbl,
                            user=request.user,
                            expires_at=expires_at,
                        )
                        for lbl in seat_labels
                    ]
                )

                from apps.bookings.services import broadcast_seat_update

                broadcast_seat_update(showtime.pk, "hold", seat_labels)
        except Exception as exc:
            logger.error("DB SeatHold write failed after Redis hold: %s", exc)
            try:
                redis_release_seats(showtime.pk, seat_labels, request.user.id)
            except Exception as redis_exc:
                # Redis rollback also failed — the TTL will auto-expire these
                # phantom locks within SEAT_HOLD_TTL seconds.
                logger.error(
                    "Redis rollback ALSO failed (phantom locks will auto-expire "
                    "in %ds): %s",
                    SEAT_HOLD_TTL,
                    redis_exc,
                )
            return Response(
                {"detail": "Failed to persist seat hold. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "held": seat_labels,
                "showtime_id": showtime.pk,
                "expires_at": expires_at.isoformat(),
                "hold_seconds": effective_ttl,
            },
            status=status.HTTP_200_OK,
        )


class ReleaseSeatsView(APIView):
    """
    POST /api/bookings/release/

    Manually release the Redis + DB holds for the current user on a showtime.
    Useful when the user explicitly cancels their selection before the 5-minute
    TTL expires, freeing the seats immediately for others.

    Body: { "showtime_id": 1 }
    Optional: { "showtime_id": 1, "seat_labels": ["A1", "A2"] }
      — omitting seat_labels releases ALL holds for the showtime.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Bookings"],
        summary="Release seat holds",
        description=(
            "Free Redis and DB seat holds for the authenticated user. "
            "Omit seat_labels to release the entire selection."
        ),
        responses={200: OpenApiResponse(description="Holds released.")},
    )
    def post(self, request):
        showtime_id = request.data.get("showtime_id")
        if not showtime_id:
            return Response(
                {"detail": "'showtime_id' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        seat_labels: list[str] | None = request.data.get("seat_labels")
        user = request.user

        # ── Redis release ─────────────────────────────────────────────
        try:
            if seat_labels:
                redis_released = redis_release_seats(showtime_id, seat_labels, user.id)
            else:
                redis_released = redis_release_all(showtime_id, user.id)
                redis_clear_session(user.id, showtime_id)
        except Exception as exc:
            logger.warning("Redis release failed: %s", exc)
            redis_released = 0

        # ── DB release ────────────────────────────────────────────────
        qs = SeatHold.objects.filter(showtime_id=showtime_id, user=user)
        if seat_labels:
            qs = qs.filter(seat_label__in=seat_labels)
        released_labels = list(qs.values_list("seat_label", flat=True))
        db_released, _ = qs.delete()

        if released_labels:
            from apps.bookings.services import broadcast_seat_update

            broadcast_seat_update(showtime_id, "release", released_labels)

        return Response(
            {
                "released_redis": redis_released,
                "released_db": db_released,
            },
            status=status.HTTP_200_OK,
        )
