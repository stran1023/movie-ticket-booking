# analytics/utils/pdf_generator.py
import os
from io import BytesIO
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone

# Try to import weasyprint with error handling
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except ImportError as e:
    WEASYPRINT_AVAILABLE = False
    print(f"WeasyPrint import error: {e}")

def generate_pdf_with_charts(request, chart_images, kpis, date_range):
    """
    Generate PDF with embedded chart images
    """
    if not WEASYPRINT_AVAILABLE:
        return HttpResponse(
            "PDF generation not available - WeasyPrint not installed",
            status=500
        )
    
    try:
        # Prepare context for template
        context = {
            'kpis': kpis,
            'date_range': date_range,
            'charts': chart_images,
            'generated_at': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
        }
        
        # Render HTML template
        html_string = render_to_string('admin/pdf_report_with_charts.html', context, request=request)
        
        # Generate PDF
        pdf_file = BytesIO()
        HTML(string=html_string).write_pdf(pdf_file)
        pdf_file.seek(0)
        
        # Create response
        response = HttpResponse(pdf_file.read(), content_type='application/pdf')
        filename = f"cinereport_{date_range['start']}_to_{date_range['end']}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        import traceback
        print("PDF Generation Error:")
        print(traceback.format_exc())
        return HttpResponse(f"PDF generation failed: {str(e)}", status=500)