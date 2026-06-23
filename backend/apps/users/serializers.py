from __future__ import annotations

from apps.movies.models import Movie
from apps.users.models import PointHistory, UserProfile
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

User = get_user_model()


class PointHistorySerializer(serializers.ModelSerializer):
    date = serializers.SerializerMethodField()
    movieTitle = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    points = serializers.SerializerMethodField()

    class Meta:
        model = PointHistory
        fields = [
            "id",
            "date",
            "movieTitle",
            "type",
            "points",
            "description",
        ]

    def _get_movie_title(self, movie_id: int) -> str:
        movie_cache = self.context.setdefault("_movie_cache", {})
        if movie_id in movie_cache:
            return movie_cache[movie_id]

        movie_title = (
            Movie.objects.filter(pk=movie_id).values_list("title", flat=True).first()
            or ""
        )
        movie_cache[movie_id] = movie_title
        return movie_title

    def get_movieTitle(self, obj: PointHistory) -> str:
        first_ticket = obj.booking.tickets.select_related("showtime").first()
        if first_ticket is None:
            return ""
        return self._get_movie_title(first_ticket.showtime.movie_id)

    def get_date(self, obj: PointHistory):
        if obj.created_at is None:
            return None
        return obj.created_at.date().isoformat()

    def get_type(self, obj: PointHistory) -> str:
        if obj.point_type == PointHistory.Type.ACCUMULATE:
            return "added"
        return "used"

    def get_points(self, obj: PointHistory) -> int:
        return abs(obj.points_amount)


class UserRegisterSerializer(serializers.Serializer):
    # User core
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    # Profile fields
    full_name = serializers.CharField(max_length=255)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(
        choices=[("male", "male"), ("female", "female"), ("other", "other")]
    )
    phone_number = serializers.CharField(
        max_length=20, required=True, allow_null=False, allow_blank=False
    )
    identity_card = serializers.CharField(
        max_length=20, required=True, allow_null=False, allow_blank=False
    )
    province = serializers.CharField(
        max_length=100, required=False, allow_null=True, allow_blank=True
    )
    ward = serializers.CharField(
        max_length=100, required=False, allow_null=True, allow_blank=True
    )
    street_address = serializers.CharField(
        max_length=255, required=False, allow_null=True, allow_blank=True
    )

    def validate(self, attrs):
        if attrs.get("password") != attrs.get("confirm_password"):
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return attrs

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(
                "A user with that username already exists."
            )
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate_phone_number(self, value):
        if value:
            if UserProfile.objects.filter(phone_number=value).exists():
                raise serializers.ValidationError(
                    "This phone number is already registered."
                )
        return value

    def validate_identity_card(self, value):
        if value:
            if UserProfile.objects.filter(identity_card=value).exists():
                raise serializers.ValidationError(
                    "This identity card is already registered."
                )
        return value

    @transaction.atomic
    def create(self, validated):
        password = validated.pop("password")
        validated.pop("confirm_password", None)

        full_name = validated.pop("full_name")
        date_of_birth = validated.pop("date_of_birth", None)
        gender = validated.pop("gender")
        phone_number = validated.pop("phone_number")
        identity_card = validated.pop("identity_card")
        province = validated.pop("province", None)
        ward = validated.pop("ward", None)
        street_address = validated.pop("street_address", None)

        user = User.objects.create_user(
            username=validated["username"],
            email=validated["email"],
            password=password,
            is_active=False,  # account is inactive until email is verified
        )

        UserProfile.objects.create(
            user=user,
            full_name=full_name,
            phone_number=phone_number,
            identity_card=identity_card,
            province=province,
            ward=ward,
            street_address=street_address,
            date_of_birth=date_of_birth,
            gender=gender,
        )

        return user

    def to_representation(self, instance):
        p = getattr(instance, "profile", None)
        return {
            "id": instance.pk,
            "username": instance.username,
            "email": instance.email,
            "profile": {
                "full_name": getattr(p, "full_name", ""),
                "phone_number": getattr(p, "phone_number", ""),
                "identity_card": getattr(p, "identity_card", ""),
                "province": getattr(p, "province", None),
                "ward": getattr(p, "ward", None),
                "street_address": getattr(p, "street_address", None),
                "date_of_birth": getattr(p, "date_of_birth", None),
                "gender": getattr(p, "gender", None),
                "total_points": getattr(p, "total_points", 0),
                "avatar_url": getattr(p, "avatar_url", ""),
                "avatar": p.avatar.url if (p and p.avatar) else None,
            },
        }


class ProfileReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            "full_name",
            "phone_number",
            "identity_card",
            "province",
            "ward",
            "street_address",
            "date_of_birth",
            "gender",
            "total_points",
            "avatar_url",
            "avatar",
            "created_at",
        )


class MeReadSerializer(serializers.ModelSerializer):
    profile = ProfileReadSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "date_joined",
            "profile",
        )


class MeWriteSerializer(serializers.ModelSerializer):
    profile = ProfileReadSerializer(read_only=True)

    full_name = serializers.CharField(
        source="profile.full_name",
        required=True,
        max_length=255,
        write_only=True,
    )
    date_of_birth = serializers.DateField(
        source="profile.date_of_birth",
        required=False,
        allow_null=True,
        write_only=True,
    )
    gender = serializers.ChoiceField(
        source="profile.gender",
        choices=[("male", "male"), ("female", "female"), ("other", "other")],
        required=True,
        write_only=True,
    )
    phone_number = serializers.CharField(
        source="profile.phone_number",
        max_length=20,
        required=True,
        allow_blank=False,
        write_only=True,
    )
    identity_card = serializers.CharField(
        source="profile.identity_card",
        max_length=20,
        required=True,
        allow_null=False,
        allow_blank=False,
        write_only=True,
    )
    province = serializers.CharField(
        source="profile.province",
        max_length=100,
        required=False,
        allow_null=True,
        allow_blank=True,
        write_only=True,
    )
    ward = serializers.CharField(
        source="profile.ward",
        max_length=100,
        required=False,
        allow_null=True,
        allow_blank=True,
        write_only=True,
    )
    street_address = serializers.CharField(
        source="profile.street_address",
        max_length=255,
        required=False,
        allow_null=True,
        allow_blank=True,
        write_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "date_joined",
            "profile",
            "full_name",
            "date_of_birth",
            "gender",
            "phone_number",
            "identity_card",
            "province",
            "ward",
            "street_address",
        )
        read_only_fields = ("id", "username", "date_joined", "profile")

    def to_internal_value(self, data):
        """
        Compatibility layer:
        - Accept flat register-style payload
        - Also accept old nested `profile` payload without changing FE
        """
        data = data.copy()

        profile_data = data.pop("profile", None)
        if isinstance(profile_data, dict):
            if "full_name" in profile_data and "full_name" not in data:
                data["full_name"] = profile_data["full_name"]
            if "phone_number" in profile_data and "phone_number" not in data:
                data["phone_number"] = profile_data["phone_number"]
            if "identity_card" in profile_data and "identity_card" not in data:
                data["identity_card"] = profile_data["identity_card"]
            if "province" in profile_data and "province" not in data:
                data["province"] = profile_data["province"]
            if "ward" in profile_data and "ward" not in data:
                data["ward"] = profile_data["ward"]
            if "street_address" in profile_data and "street_address" not in data:
                data["street_address"] = profile_data["street_address"]
            if "date_of_birth" in profile_data and "date_of_birth" not in data:
                data["date_of_birth"] = profile_data["date_of_birth"]
            if "gender" in profile_data and "gender" not in data:
                data["gender"] = profile_data["gender"]

        return super().to_internal_value(data)

    def validate_email(self, value):
        qs = User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate_phone_number(self, value):
        if value:
            qs = UserProfile.objects.filter(phone_number=value).exclude(
                user_id=self.instance.pk
            )
            if qs.exists():
                raise serializers.ValidationError(
                    "This phone number is already registered."
                )
        return value

    def validate_identity_card(self, value):
        if value:
            qs = UserProfile.objects.filter(identity_card=value).exclude(
                user_id=self.instance.pk
            )
            if qs.exists():
                raise serializers.ValidationError(
                    "This identity card is already registered."
                )
        return value

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})

        if "email" in validated_data:
            instance.email = validated_data["email"]
            instance.save(update_fields=["email"])

        profile = instance.profile
        for field, value in profile_data.items():
            setattr(profile, field, value)
        profile.save()

        return instance


class AvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("avatar",)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate(self, attrs):
        if attrs["old_password"] == attrs["new_password"]:
            raise serializers.ValidationError(
                {
                    "new_password": "New password must be different from the current password."
                }
            )
        return attrs
