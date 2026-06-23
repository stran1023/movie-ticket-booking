from django.contrib.admin import AdminSite
from django.template.response import TemplateResponse
from django.urls import path
from django.http import JsonResponse
from django.contrib.admin.models import LogEntry

import json
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from analytics.utils.pdf_generator import generate_pdf_with_charts

from analytics.services import (
    get_dashboard_kpis,
    get_bookings_trend,
    get_revenue_trend,
    get_top_movies,
    get_tickets_by_time_range,
)


class CineBookAdminSite(AdminSite):

    site_header = "CineBook Admin"
    site_title = "CineBook Admin Portal"
    index_title = "Dashboard"

    def bookings_trend_api(self, request):
        """API endpoint for bookings trend with filters"""
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        group_by = request.GET.get('group_by', 'day')
        
        data = get_bookings_trend(start_date, end_date, group_by)
        return JsonResponse(data, safe=False)

    def revenue_trend_api(self, request):
        """API endpoint for revenue trend with filters"""
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        group_by = request.GET.get('group_by', 'day')
        compare = request.GET.get('compare', 'false').lower() == 'true'
        
        data = get_revenue_trend(start_date, end_date, group_by, compare)
        return JsonResponse(data, safe=False)

    def top_movies_api(self, request):
        """API endpoint for top movies with filters"""
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        top_n = int(request.GET.get('top_n', 5))
        
        data = get_top_movies(start_date, end_date, top_n)
        return JsonResponse(data, safe=False)
    
    def tickets_by_time_range_api(self, request):
        """API endpoint for tickets by time range with filters"""
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        data = get_tickets_by_time_range(start_date, end_date)
        return JsonResponse(data, safe=False)
    
    def kpis_api(self, request):
        """API endpoint for KPIs with filters"""
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        data = get_dashboard_kpis(start_date, end_date)
        return JsonResponse(data, safe=False)
    
    @method_decorator(csrf_exempt)
    def export_pdf_api(self, request):
        """API endpoint for PDF export with chart images"""
        if request.method == 'POST':
            try:
                # Log received data for debugging
                print("=" * 50)
                print("PDF Export Request Received")
                print(f"Content-Type: {request.content_type}")
                print(f"Body length: {len(request.body)}")
                
                # Parse JSON data with error handling
                try:
                    data = json.loads(request.body)
                    print(f"Parsed JSON keys: {data.keys()}")
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    return JsonResponse({'error': f'Invalid JSON: {str(e)}'}, status=400)
                
                chart_images = data.get('chart_images', {})
                kpis = data.get('kpis', {})
                
                print(f"Received {len(chart_images)} chart images: {list(chart_images.keys())}")
                print(f"KPIs: {kpis}")
                
                # Ensure we have at least some charts
                if not chart_images:
                    print("Warning: No chart images received")
                    # Create placeholder images if needed
                    pass
                
                # Get date range from query params
                start_date = request.GET.get('start_date', 'N/A')
                end_date = request.GET.get('end_date', 'N/A')
                
                date_range = {
                    'start': start_date,
                    'end': end_date
                }
                
                # Generate PDF
                return generate_pdf_with_charts(request, chart_images, kpis, date_range)
                
            except Exception as e:
                import traceback
                print("Export PDF API Error:")
                traceback.print_exc()
                return JsonResponse({'error': str(e)}, status=500)
        
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    def get_urls(self):
        urls = super().get_urls()

        custom_urls = [
            path("dashboard/", self.admin_view(self.dashboard_view), name="dashboard"),
            
            # API endpoints
            path("api/kpis/", self.admin_view(self.kpis_api)),
            path("api/bookings-trend/", self.admin_view(self.bookings_trend_api)),
            path("api/revenue-trend/", self.admin_view(self.revenue_trend_api)),
            path("api/top-movies/", self.admin_view(self.top_movies_api)),
            path('api/tickets-by-time-range/', self.admin_view(self.tickets_by_time_range_api)),
            path('api/export-pdf/', self.admin_view(self.export_pdf_api)),
            path(
                "user-management/",
                self.admin_view(self.user_management_view),
                name="user-management",
            ),
        ]

        return custom_urls + urls
    
    def user_management_view(self, request):
        context = dict(
            self.each_context(request),
            title="User Management",
        )
        return TemplateResponse(request, "admin/user_management.html", context)

    def dashboard_view(self, request):
        """Main dashboard view"""
        context = dict(
            self.each_context(request),
            kpis=get_dashboard_kpis(),  # Default KPIs for initial load
            recent_actions=LogEntry.objects.select_related("user", "content_type")[:10]
        )

        return TemplateResponse(
            request,
            "admin/dashboard.html",
            context,
        )
    
    def get_app_list(self, request):
        app_list = super().get_app_list(request)

        # models to hide
        hidden_models = {
            "LogEntry",
            "Group",
            "Permission",
            "ContentType",
        }

        for app in app_list:
            app["models"] = [
                m for m in app["models"]
                if m["object_name"] not in hidden_models
            ]

        return app_list


admin_site = CineBookAdminSite(name="admin")