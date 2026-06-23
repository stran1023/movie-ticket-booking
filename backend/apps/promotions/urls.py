from django.urls import path

from .api_views import (
    PromotionRedeemAPIView,
    PromotionValidateAPIView,
    AllPromotionsListAPIView,
    UserPromotionsListAPIView,
    MoviePromotionsListAPIView,
    PromotionDetailAPIView,
    FlatPricePromotionListAPIView,
    FlatPricePromotionValidateAPIView,
    CommunityPromoTicketsAPIView,
)

urlpatterns = [
    path(
        "promotions/validate",
        PromotionValidateAPIView.as_view(),
        name="promotion-validate",
    ),
    path(
        "promotions/redeem", PromotionRedeemAPIView.as_view(), name="promotion-redeem"
    ),
    path(
        "promotions/all",
        AllPromotionsListAPIView.as_view(),
        name="all-promotions-list",
    ),
    path(
        "promotions/users",
        UserPromotionsListAPIView.as_view(),
        name="user-promotions-list",
    ),
    path(
        "promotions/movies",
        MoviePromotionsListAPIView.as_view(),
        name="movie-promotions-list",
    ),
    path(
        "promotions/<int:pk>/",
        PromotionDetailAPIView.as_view(),
        name="promotion-detail",
    ),
    # Flat price promotion endpoints
    path(
        "flat-price-promotions/",
        FlatPricePromotionListAPIView.as_view(),
        name="flat-price-promotion-list",
    ),
    path(
        "flat-price-promotions/validate/",
        FlatPricePromotionValidateAPIView.as_view(),
        name="flat-price-promotion-validate",
    ),
    path(
        "promotions/community",
        CommunityPromoTicketsAPIView.as_view(),
        name="promotion-community-tickets",
    ),
]
