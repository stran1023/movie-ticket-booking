from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    ConcessionViewSet,
    OrderItemViewSet,
    OrderViewSet,
    PricePreviewViewSet,
    VariantViewSet,
)

router = DefaultRouter()
router.register(
    "categories", CategoryViewSet, basename="concession-categories"
)
router.register("concessions", ConcessionViewSet, basename="concession-list")
router.register("variants", VariantViewSet, basename="concession-variants")
router.register("orders", OrderViewSet, basename="concession-orders")
router.register("items", OrderItemViewSet, basename="concession-items")
router.register(
    "price/preview", PricePreviewViewSet, basename="concession-price-preview"
)

urlpatterns = [
    path("", include(router.urls)),
]
