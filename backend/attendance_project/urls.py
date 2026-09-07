import os
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import HttpResponse, FileResponse

FRONTEND_DIST = Path(settings.BASE_DIR).parent / 'client' / 'dist'

def serve_spa_index(request):
    dist_index = FRONTEND_DIST / 'index.html'
    if dist_index.exists():
        return FileResponse(open(dist_index, 'rb'), content_type='text/html')
    return HttpResponse(
        "<h2>Smart Attendance QR System API is Live!</h2><p>Frontend assets are being built.</p>",
        content_type="text/html"
    )

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

# Explicitly serve Vite static bundle assets (/assets/...)
urlpatterns += [
    re_path(r'^assets/(?P<path>.*)$', serve, {
        'document_root': FRONTEND_DIST / 'assets',
    }),
]

# Catch-all route to serve the Single Page Application (React Vite Frontend)
urlpatterns += [
    re_path(r'^(?!api|admin|media|static|assets).*$', serve_spa_index, name='spa_index'),
]
