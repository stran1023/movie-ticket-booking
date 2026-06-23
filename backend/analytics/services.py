from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, Value, Case, When, CharField, Q
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth, ExtractHour
from django.utils import timezone
from datetime import timedelta, datetime
from typing import Optional, Dict, Any, List

from apps.bookings.models import Booking
from apps.movies.models import Movie
from apps.cinemas.models import Showtime
from apps.bookings.models import Ticket

User = get_user_model()


def parse_date_range(start_date: Optional[str], end_date: Optional[str], days_back: Optional[int] = 30):
    """
    Parse date range from request parameters.
    Returns (start_date, end_date) as datetime objects.
    """
    if start_date and end_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            # Add one day to include the end date
            end = datetime.combine(end, datetime.max.time())
            start = datetime.combine(start, datetime.min.time())
            # Make timezone aware
            start = timezone.make_aware(start)
            end = timezone.make_aware(end)
            return start, end
        except ValueError:
            pass
    
    # Default: last X days
    end = timezone.now()
    start = end - timedelta(days=days_back)
    return start, end


def get_dashboard_kpis(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """
    Get KPIs with optional date range filtering.
    """
    start, end = parse_date_range(start_date, end_date, 30)
    
    # Base querysets with date filtering
    bookings_qs = Booking.objects.filter(created_at__range=[start, end])
    completed_bookings_qs = bookings_qs.filter(status="completed")
    
    revenue = completed_bookings_qs.aggregate(
        total=Sum("final_amount")
    )["total"] or 0

    bookings = bookings_qs.count()

    # Movies and users don't typically need date filtering
    movies = Movie.objects.count()
    users = User.objects.count()

    return {
        "users": users,
        "revenue": revenue,
        "bookings": bookings,
        "movies": movies,
        "date_range": {
            "start": start.strftime('%Y-%m-%d'),
            "end": end.strftime('%Y-%m-%d')
        }
    }


def get_bookings_trend(start_date: Optional[str] = None, end_date: Optional[str] = None, group_by: str = "day"):
    """
    Get bookings trend with date range and grouping options.
    group_by: 'day', 'week', 'month'
    """
    start, end = parse_date_range(start_date, end_date, 30)
    
    # Base queryset
    qs = Booking.objects.filter(created_at__range=[start, end])
    
    # Apply grouping
    if group_by == "week":
        qs = qs.annotate(period=TruncWeek("created_at"))
    elif group_by == "month":
        qs = qs.annotate(period=TruncMonth("created_at"))
    else:  # day
        qs = qs.annotate(period=TruncDate("created_at"))
    
    qs = (qs
          .values("period")
          .annotate(bookings=Count("id"))
          .order_by("period"))
    
    # Format response
    result = []
    for item in qs:
        result.append({
            "period": item["period"].strftime('%Y-%m-%d') if item["period"] else None,
            "bookings": item["bookings"]
        })
    
    return result


def get_revenue_trend(start_date: Optional[str] = None, end_date: Optional[str] = None, 
                      group_by: str = "day", compare_previous: bool = False):
    """
    Get revenue trend with date range and comparison options.
    """
    start, end = parse_date_range(start_date, end_date, 30)
    
    # Main period queryset
    qs = Booking.objects.filter(
        status="completed",
        created_at__range=[start, end]
    )
    
    if group_by == "week":
        qs = qs.annotate(period=TruncWeek("created_at"))
    elif group_by == "month":
        qs = qs.annotate(period=TruncMonth("created_at"))
    else:
        qs = qs.annotate(period=TruncDate("created_at"))
    
    qs = (qs
          .values("period")
          .annotate(revenue=Sum("final_amount"))
          .order_by("period"))
    
    result = []
    for item in qs:
        result.append({
            "period": item["period"].strftime('%Y-%m-%d') if item["period"] else None,
            "revenue": float(item["revenue"]) if item["revenue"] else 0
        })
    
    # Add comparison data if requested
    if compare_previous:
        # Calculate previous period of same length
        period_length = (end - start).days
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=period_length)
        
        prev_qs = Booking.objects.filter(
            status="completed",
            created_at__range=[prev_start, prev_end]
        )
        
        if group_by == "week":
            prev_qs = prev_qs.annotate(period=TruncWeek("created_at"))
        elif group_by == "month":
            prev_qs = prev_qs.annotate(period=TruncMonth("created_at"))
        else:
            prev_qs = prev_qs.annotate(period=TruncDate("created_at"))
        
        prev_data = list(prev_qs
                        .values("period")
                        .annotate(revenue=Sum("final_amount"))
                        .order_by("period"))
        
        for item in prev_data:
            item["period"] = item["period"].strftime('%Y-%m-%d') if item["period"] else None
            item["revenue"] = float(item["revenue"]) if item["revenue"] else 0
        
        return {
            "current": result,
            "previous": prev_data
        }
    
    return result


def get_top_movies(start_date: Optional[str] = None, end_date: Optional[str] = None, 
                   top_n: int = 5, group_by: Optional[str] = None):
    """
    Get top movies by tickets sold with date range filtering.
    """
    start, end = parse_date_range(start_date, end_date, 30)
    
    # Filter showtimes by date range
    showtimes = Showtime.objects.filter(
        start_time__range=[start, end]
    )
    
    qs = (showtimes
          .values("movie_id")
          .annotate(
              tickets_sold=Count("tickets"),
              revenue=Sum("tickets__booking__final_amount")
          )
          .order_by("-tickets_sold")[:top_n])
    
    results = []
    for row in qs:
        movie = Movie.objects.filter(id=row["movie_id"]).first()
        
        results.append({
            "movie": movie.title if movie else "Unknown",
            "tickets_sold": row["tickets_sold"],
            "revenue": float(row["revenue"]) if row["revenue"] else 0,
            "movie_id": row["movie_id"]
        })
    
    return results


def get_tickets_by_time_range(start_date: Optional[str] = None, end_date: Optional[str] = None,
                              time_ranges: Optional[Dict] = None):
    """
    Group tickets into customizable time ranges.
    """
    start, end = parse_date_range(start_date, end_date, 30)
    
    # Default time ranges if not provided
    if not time_ranges:
        time_ranges = {
            'Morning': (6, 12),
            'Afternoon': (12, 17),
            'Evening': (17, 21),
            'Night': (21, 6)  # Spans midnight
        }
    
    # Build Case conditions dynamically
    conditions = []
    for range_name, (start_hour, end_hour) in time_ranges.items():
        if start_hour < end_hour:  # Normal range
            conditions.append(
                When(hour__gte=start_hour, hour__lt=end_hour, then=Value(range_name))
            )
        else:  # Overnight range (e.g., Night: 21-6)
            conditions.append(
                When(Q(hour__gte=start_hour) | Q(hour__lt=end_hour), then=Value(range_name))
            )
    
    qs = (
        Ticket.objects.filter(
            showtime__start_time__range=[start, end]
        )
        .annotate(hour=ExtractHour("showtime__start_time"))
        .annotate(time_range=Case(
            *conditions,
            output_field=CharField()
        ))
        .values("time_range")
        .annotate(
            tickets_sold=Count("id"),
            revenue=Sum("booking__final_amount"),
            unique_shows=Count("showtime", distinct=True)
        )
    )
    
    # Define order
    range_order = {name: i for i, name in enumerate(time_ranges.keys())}
    
    result = list(qs)
    result.sort(key=lambda x: range_order.get(x['time_range'], 999))
    
    # Add percentages and format
    total_tickets = sum(item['tickets_sold'] for item in result)
    for item in result:
        item['percentage'] = round((item['tickets_sold'] / total_tickets * 100), 1) if total_tickets > 0 else 0
        item['revenue'] = float(item['revenue']) if item['revenue'] else 0
        item['avg_ticket_price'] = round(item['revenue'] / item['tickets_sold'], 2) if item['tickets_sold'] > 0 else 0
    
    return {
        "data": result,
        "total_tickets": total_tickets,
        "total_revenue": sum(item['revenue'] for item in result),
        "time_ranges": time_ranges
    }


def get_chart_data_raw(start_date: Optional[str] = None, end_date: Optional[str] = None, chart_type: str = "all"):
    """
    Get all chart data in one request for PDF export.
    """
    start, end = parse_date_range(start_date, end_date, 30)
    
    data = {
        "kpis": get_dashboard_kpis(start_date, end_date),
        "date_range": {
            "start": start.strftime('%Y-%m-%d'),
            "end": end.strftime('%Y-%m-%d')
        }
    }
    
    if chart_type in ["all", "bookings"]:
        data["bookings_trend"] = get_bookings_trend(start_date, end_date)
    
    if chart_type in ["all", "revenue"]:
        data["revenue_trend"] = get_revenue_trend(start_date, end_date)
    
    if chart_type in ["all", "movies"]:
        data["top_movies"] = get_top_movies(start_date, end_date)
    
    if chart_type in ["all", "time"]:
        data["tickets_by_time"] = get_tickets_by_time_range(start_date, end_date)
    
    return data