import os
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import HttpResponse, FileResponse

def serve_spa_index(request):
    dist_index = Path(settings.BASE_DIR).parent / 'client' / 'dist' / 'index.html'
    if dist_index.exists():
        return FileResponse(open(dist_index, 'rb'), content_type='text/html')
    return HttpResponse(
        "<h2>Smart Attendance QR System API is Live!</h2><p>Frontend assets are being built or please run the React development server.</p>",
        content_type="text/html"
    )

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('attendance_api.urls')),
]

# Serve media files in both development and production
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Catch-all route to serve the Single Page Application (React Vite Frontend)
urlpatterns += [
    re_path(r'^(?!api|admin|media|static).*$', serve_spa_index, name='spa_index'),
]
