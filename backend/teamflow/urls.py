from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from notifications.views import NotificationViewSet
from organizations.views import InvitationViewSet, MembershipViewSet, OrganizationViewSet, TeamViewSet
from projects.views import (
    ActivityViewSet,
    AttachmentViewSet,
    CommentViewSet,
    DashboardView,
    LabelViewSet,
    ProjectViewSet,
    SearchView,
    TaskViewSet,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("memberships", MembershipViewSet, basename="membership")
router.register("invitations", InvitationViewSet, basename="invitation")
router.register("teams", TeamViewSet, basename="team")
router.register("projects", ProjectViewSet, basename="project")
router.register("tasks", TaskViewSet, basename="task")
router.register("comments", CommentViewSet, basename="comment")
router.register("labels", LabelViewSet, basename="label")
router.register("attachments", AttachmentViewSet, basename="attachment")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("activity", ActivityViewSet, basename="activity")


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", RedirectView.as_view(pattern_name="swagger-ui"), name="root"),
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/auth/", include("accounts.urls")),
    path("api/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("api/search/", SearchView.as_view(), name="search"),
    path("api/", include(router.urls)),
]
