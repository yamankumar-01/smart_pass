import os
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.shortcuts import redirect
from django.http import HttpResponse, FileResponse, JsonResponse

def backend_root_redirect_view(request, path=''):
    """
    Since the frontend is hosted on Vercel (https://smartpass-orpin.vercel.app),
    browser requests to root or frontend paths are cleanly redirected to Vercel.
    API/Curl/JSON requests receive a service status response.
    """
    accept = request.headers.get('accept', '')
    if 'text/html' in accept:
        clean_path = path.lstrip('/')
        target_url = f"https://smartpass-orpin.vercel.app/{clean_path}" if clean_path else "https://smartpass-orpin.vercel.app/"
        return redirect(target_url)

    return JsonResponse({
        "status": "online",
        "service": "SmartPass Attendance API",
        "frontend": "https://smartpass-orpin.vercel.app",
        "endpoints": {
            "api": "/api/",
            "admin": "/admin/"
        }
    })

def serve_dynamic_qr_view(request, path):
    """
    Guarantees that QR code images are ALWAYS served with 200 OK, even on
    ephemeral containers (like Render) or fresh deployments where files on disk are absent.
    If the requested file exists, it is served directly.
    If absent, the UUID is extracted and the QR code is generated on-the-fly and cached.
    """
    import re
    from attendance_api.utils import generate_qr_code

    file_path = Path(settings.MEDIA_ROOT) / 'qr_codes' / path
    if file_path.exists():
        return FileResponse(open(file_path, 'rb'), content_type="image/png")

    match = re.search(r'([0-9a-fA-F-]{32,36})', path)
    if match:
        token = match.group(1)
        file_content, _ = generate_qr_code(token)
        raw_bytes = file_content.read()
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, 'wb') as f:
                f.write(raw_bytes)
        except Exception:
            pass
        return HttpResponse(raw_bytes, content_type="image/png")

    return HttpResponse("Image not found", status=404)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('attendance_api.urls')),
    path('media/qr_codes/<path:path>', serve_dynamic_qr_view, name='dynamic_qr'),
]

# Serve other media files if any
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Catch-all: Route browser navigation to Vercel frontend, and return API status for clients
urlpatterns += [
    re_path(r'^(?!api|admin|media|static)(?P<path>.*)$', backend_root_redirect_view, name='backend_root_redirect'),
]
