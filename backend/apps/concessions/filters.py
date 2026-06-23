import django_filters

from .models import Concession, ConcessionOrder, ConcessionVariant


class ConcessionFilter(django_filters.FilterSet):
    effective_active = django_filters.BooleanFilter(
        method="filter_effective_active"
    )

    class Meta:
        model = Concession
        fields = ["category", "is_combo", "is_active"]

    def filter_effective_active(self, qs, name, value):
        if value is True:
            return qs.filter(is_active=True, category__is_active=True)
        if value is False:
            return qs.exclude(is_active=True, category__is_active=True)
        return qs


class VariantFilter(django_filters.FilterSet):
    class Meta:
        model = ConcessionVariant
        fields = ["concession", "is_active"]


class OrderFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(
        field_name="created_at", lookup_expr="date__gte"
    )
    date_to = django_filters.DateFilter(
        field_name="created_at", lookup_expr="date__lte"
    )
    sales_channel = django_filters.CharFilter(field_name="sales_channel")

    class Meta:
        model = ConcessionOrder
        fields = ["sales_channel", "booking"]
