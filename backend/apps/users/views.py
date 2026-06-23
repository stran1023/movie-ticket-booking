from __future__ import annotations

import uuid

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    extend_schema,
)
from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

# Reuse domain objects/serializers from bookings app
from apps.bookings.models import Booking
from apps.bookings.serializers import BookedTicketSerializer
from apps.movies.models import Movie
from apps.movies.serializers import MovieSerializer

from .models import PointHistory, PointRedemptionConfig, PointTransaction
from .serializers import (
    AvatarSerializer,
    ChangePasswordSerializer,
    MeReadSerializer,
    MeWriteSerializer,
    PointHistorySerializer,
    UserRegisterSerializer,
)
from .services import (
    _get_or_create_user_point,
    calculate_redeemable_points,
    redeem_points,
)
from .tasks import send_activation_email, send_password_reset_email
from .throttles import EmailActionThrottle, LoginThrottle

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [EmailActionThrottle]

    @extend_schema(
        tags=["Auth"],
        summary="Register a new user",
        description="Create a new user and the associated profile.",
        request=UserRegisterSerializer,
        responses={
            201: OpenApiResponse(response=UserRegisterSerializer),
            400: OpenApiResponse(description="Validation errors"),
        },
        examples=[
            OpenApiExample(
                "Register",
                value={
                    "username": "jane",
                    "email": "jane@example.com",
                    "password": "StrongPass!123",
                    "confirm_password": "StrongPass!123",
                    "full_name": "Jane Doe",
                    "date_of_birth": "1999-05-20",
                    "gender": "female",
                    "phone_number": "0912345678",
                    "identity_card": "079095001234",
                    "province": "Hồ Chí Minh",
                    "ward": "Phường Bến Nghé",
                    "street_address": "123 Đường Lê Lợi",
                },
            )
        ],
    )
    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()

        # Dispatch activation email asynchronously — do not block the response.
        send_activation_email.delay(user.id, settings.FRONTEND_URL)

        return Response(
            {
                "detail": (
                    "Registration successful. "
                    "Please check your email to activate your account."
                )
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    """
    POST /api/auth/verify-email/
    Accepts { "uid": "<uidb64>", "token": "<token>" } and activates the
    matching user account when the token is valid.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Verify email and activate account",
        description=(
            "Validates the uid/token pair sent in the activation email. "
            "On success the user account is activated and they can log in."
        ),
        responses={
            200: OpenApiResponse(description="Account activated successfully."),
            400: OpenApiResponse(description="Invalid or expired activation link."),
        },
    )
    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")

        if not uid or not token:
            return Response(
                {"detail": "Both 'uid' and 'token' are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {"detail": "Invalid activation link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.is_active:
            return Response(
                {"detail": "Account is already active."},
                status=status.HTTP_200_OK,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Activation link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = True
        user.save(update_fields=["is_active"])

        return Response(
            {"detail": "Account activated successfully. You can now log in."},
            status=status.HTTP_200_OK,
        )


class ForgotPasswordView(APIView):
    """
    POST /api/auth/forgot-password/
    Accepts { "email": "..." } and dispatches a password-reset email when an
    active account is found.  Always returns HTTP 200 to prevent enumeration.
    """

    permission_classes = [AllowAny]
    throttle_classes = [EmailActionThrottle]

    @extend_schema(
        tags=["Auth"],
        summary="Request a password reset email",
        description=(
            "Sends a password-reset link to the provided email address if an "
            "active account exists. The response is always HTTP 200 regardless "
            "of whether the email is registered, preventing account enumeration."
        ),
        responses={
            200: OpenApiResponse(
                description="Password reset email sent (if account exists)."
            ),
        },
    )
    def post(self, request):
        email = request.data.get("email", "").strip().lower()

        if email:
            try:
                user = User.objects.get(email__iexact=email, is_active=True)
                send_password_reset_email.delay(user.id, settings.FRONTEND_URL)
            except User.DoesNotExist:
                pass  # Intentionally silent — do not leak whether email is registered

        return Response(
            {
                "detail": (
                    "If an account with this email exists, "
                    "a password reset link has been sent."
                )
            },
            status=status.HTTP_200_OK,
        )


class ResetPasswordConfirmView(APIView):
    """
    POST /api/auth/reset-password-confirm/
    Accepts { "uid", "token", "new_password" } and sets the new password when
    the uid/token pair is valid.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Confirm password reset and set a new password",
        description=(
            "Validates the uid/token pair from the reset email and, if valid, "
            "updates the user's password. All outstanding sessions are invalidated "
            "on success."
        ),
        responses={
            200: OpenApiResponse(description="Password reset successfully."),
            400: OpenApiResponse(description="Invalid/expired token or weak password."),
        },
    )
    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")

        if not uid or not token or not new_password:
            return Response(
                {"detail": "'uid', 'token', and 'new_password' are all required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Decode uid and fetch user
        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {"detail": "Invalid password reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate token before touching the password
        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Run Django's built-in password validators
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response(
                {"new_password": list(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        # Invalidate every active session so compromised devices are signed out
        outstanding_tokens = OutstandingToken.objects.filter(user=user)
        for t in outstanding_tokens:
            BlacklistedToken.objects.get_or_create(token=t)

        return Response(
            {"detail": "Password reset successfully. You can now log in."},
            status=status.HTTP_200_OK,
        )


class MeView(RetrieveUpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return MeWriteSerializer
        return MeReadSerializer

    @extend_schema(
        tags=["Auth"], summary="Get current user", responses=MeReadSerializer
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class LoginView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]  # [SECURITY] Prevent brute-force attacks

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if not user:
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)

        response = Response({"access": str(refresh.access_token)})

        response.set_cookie(
            key="refresh_token",
            value=str(refresh),
            httponly=True,
            secure=False,  # True in production
            samesite="Lax",
            path="/api/token/refresh/",
        )

        return response


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")

        if not refresh_token:
            return Response({"detail": "No refresh token"}, status=401)

        try:
            refresh = RefreshToken(refresh_token)

            user_id = refresh["user_id"]
            user = User.objects.get(id=user_id)

            new_access = str(refresh.access_token)
            new_refresh = str(RefreshToken.for_user(user))

            response = Response({"access": new_access})

            response.set_cookie(
                key="refresh_token",
                value=new_refresh,
                httponly=True,
                secure=False,  # True in production
                samesite="Lax",
            )

            return response

        except Exception:
            return Response({"detail": "Invalid refresh token"}, status=401)


class LogoutView(APIView):
    def post(self, request):

        response = Response({"detail": "Logged out"})
        response.delete_cookie("refresh_token")

        return response


class MePointHistoryAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        point_histories = (
            PointHistory.objects.filter(user_profile=profile)
            .select_related("booking")
            .prefetch_related("booking__tickets__showtime")
            .order_by("-created_at")
        )
        serializer = PointHistorySerializer(
            point_histories, many=True, context={"request": request}
        )
        return Response(serializer.data)


class ChangePasswordView(APIView):
    """
    PUT /api/change-password/
    Changes the authenticated user's password and blacklists all their
    outstanding refresh tokens to force a global logout.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Change password",
        description=(
            "Updates the user's password. On success, all outstanding refresh "
            "tokens are blacklisted so every active session is invalidated."
        ),
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password changed successfully."),
            400: OpenApiResponse(description="Validation errors."),
        },
    )
    def put(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

        # Blacklist every outstanding refresh token for this user so all
        # devices / sessions are immediately signed out.
        outstanding_tokens = OutstandingToken.objects.filter(user=user)
        for token in outstanding_tokens:
            BlacklistedToken.objects.get_or_create(token=token)

        return Response(
            {"detail": "Password changed successfully. Please log in again."},
            status=status.HTTP_200_OK,
        )


class MeTicketsAPIView(APIView):
    """
    GET /api/me/tickets/
    Returns all bookings (with tickets) belonging to the authenticated user.
    Mirrors the logic of AccountBookedTicketsAPIView but under /me/.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Me"],
        summary="List my booked tickets",
        description="Return non-deleted bookings for the current user, including ticket details.",
        responses={200: OpenApiResponse(response=BookedTicketSerializer(many=True))},
    )
    def get(self, request):
        profile = request.user.profile

        bookings = (
            Booking.objects.filter(user_profile_id=profile, is_deleted=False)
            .prefetch_related(
                "tickets__showtime__cinema_room",
                "tickets__seat",
            )
            .order_by("-created_at")
        )

        serializer = BookedTicketSerializer(
            bookings, many=True, context={"request": request}
        )
        return Response(serializer.data)


class DeactivateAccountView(APIView):
    """
    DELETE /api/me/delete/
    Soft-deletes the authenticated user's account:
      1. Anonymizes unique fields (email, identity_card) so they can be reused.
      2. Clears sensitive profile data (phone_number, identity_card).
      3. Sets is_active=False (soft delete — preserves booking history).
      4. Blacklists all outstanding JWT tokens to force global logout.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user

        # 1. Anonymize email to free the unique constraint for future re-registrations
        user.email = f"deleted_{uuid.uuid4().hex[:8]}_{user.email}"
        user.is_active = False
        user.is_deleted = True
        user.save(update_fields=["email", "is_active", "is_deleted"])

        # 2. Clear sensitive / unique profile fields
        profile = getattr(user, "profile", None)
        if profile is not None:
            profile.phone_number = ""
            profile.identity_card = None  # unique=True, null=True — must be freed
            profile.is_deleted = True
            profile.save(update_fields=["phone_number", "identity_card", "is_deleted"])

        # 3. Blacklist all outstanding tokens (force global logout across all devices)
        tokens = OutstandingToken.objects.filter(user=user)
        for token in tokens:
            BlacklistedToken.objects.get_or_create(token=token)

        return Response(status=status.HTTP_204_NO_CONTENT)


class AvatarUploadView(APIView):
    """
    PATCH /api/me/avatar/
    Upload or replace the authenticated user's avatar.
    Expects multipart/form-data with a single 'avatar' image file.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Me"],
        summary="Upload avatar",
        description="Upload or replace the current user's profile picture. Send as multipart/form-data with field 'avatar'.",
        request=AvatarSerializer,
        responses={
            200: OpenApiResponse(response=AvatarSerializer),
            400: OpenApiResponse(description="Validation errors."),
        },
    )
    def patch(self, request):
        profile = request.user.profile
        serializer = AvatarSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Me"],
        summary="Delete avatar",
        description="Remove the current user's profile picture. The file is deleted from storage automatically.",
        responses={204: OpenApiResponse(description="Avatar removed.")},
    )
    def delete(self, request):
        profile = request.user.profile
        profile.avatar = None
        profile.save(update_fields=["avatar"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Points API ───────────────────────────────────────────────────────────


class PointRedemptionConfigAPIView(APIView):
    """GET /api/points/config/ — public, returns current redemption rules."""

    permission_classes = [AllowAny]

    def get(self, request):
        config = PointRedemptionConfig.objects.first()
        if config is None:
            return Response(
                {
                    "max_redeem_percentage": 50,
                    "min_points_to_redeem": 4,
                    "points_per_vnd": 500,
                    "is_active": False,
                }
            )
        return Response(
            {
                "max_redeem_percentage": config.max_redeem_percentage,
                "min_points_to_redeem": config.min_points_to_redeem,
                "points_per_vnd": config.points_per_vnd,
                "is_active": config.is_active,
            }
        )


class PointBalanceAPIView(APIView):
    """GET /api/points/balance/ — authenticated user's point balance."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_point = _get_or_create_user_point(request.user)
        return Response(
            {
                "balance": user_point.balance,
                "total_earned": user_point.total_earned,
                "total_redeemed": user_point.total_redeemed,
            }
        )


class PointCalculateAPIView(APIView):
    """
    GET /api/points/calculate/?subtotal=&amount_already_discounted=
    Runs the full 6-step redeemable-points calculation.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            subtotal = float(request.query_params.get("subtotal", 0))
            amount_already_discounted = float(
                request.query_params.get("amount_already_discounted", 0)
            )
        except (ValueError, TypeError):
            return Response(
                {"detail": "subtotal and amount_already_discounted must be numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = calculate_redeemable_points(
            request.user, subtotal, amount_already_discounted
        )
        return Response(result)


class PointRedeemAPIView(APIView):
    """
    POST /api/points/redeem/
    Body: { "booking_id": int, "points_to_redeem": int,
            "subtotal": int, "amount_already_discounted": int }
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get("booking_id")
        points_to_redeem = request.data.get("points_to_redeem")
        subtotal = request.data.get("subtotal", 0)
        amount_already_discounted = request.data.get("amount_already_discounted", 0)

        if not booking_id or not points_to_redeem:
            return Response(
                {"detail": "booking_id and points_to_redeem are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            points_to_redeem = int(points_to_redeem)
            subtotal = int(subtotal)
            amount_already_discounted = int(amount_already_discounted)
        except (ValueError, TypeError):
            return Response(
                {"detail": "points_to_redeem, subtotal must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking = Booking.objects.filter(pk=booking_id).first()
        if not booking:
            return Response(
                {"detail": "Booking not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            result = redeem_points(
                request.user,
                booking,
                points_to_redeem,
                subtotal,
                amount_already_discounted,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)


class PointTransactionHistoryAPIView(APIView):
    """GET /api/points/history/ — paginated transaction log for current user."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transactions = (
            PointTransaction.objects.filter(user=request.user)
            .select_related("booking")
            .order_by("-created_at")
        )

        data = [
            {
                "id": t.id,
                "transaction_type": t.transaction_type,
                "points": t.points,
                "balance_after": t.balance_after,
                "booking_code": t.booking.booking_code if t.booking else None,
                "note": t.note,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transactions[:100]
        ]
        return Response(data)


class MeRemindersAPIView(APIView):
    """
    Returns all COMING_SOON movies that the user is subscribed to.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Me"],
        summary="List my movie reminders",
        description="Return all COMING_SOON movies the current user has requested alerts for.",
        responses={200: OpenApiResponse(response=MovieSerializer(many=True))},
    )
    def get(self, request):
        user_email = request.user.email

        # Filter movies where there is a reminder matching this user's email,
        # and ensure the movie is still COMING_SOON.
        movies = (
            Movie.objects.filter(reminders__email=user_email, status="COMING_SOON")
            .distinct()
            .order_by("release_date")
        )

        serializer = MovieSerializer(movies, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)
