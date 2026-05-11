from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

admin.site.site_header = "⚡ DECT Admin Panel"
admin.site.site_title  = "DECT Admin"
admin.site.index_title = "Decentralized Energy Credit & Trading"

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("auth/",         include("api.auth_urls")),
    path("api/",          include("api.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)