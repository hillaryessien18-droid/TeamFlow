from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from organizations.permissions import query_int

from .models import Notification
from .serializers import NotificationSerializer, UnreadCountSerializer


class NotificationViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """The current user's notifications, newest first. Filters: ?unread=true&limit= (max 100)."""

    serializer_class = NotificationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        return Notification.objects.filter(recipient=self.request.user).select_related("actor", "organization")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        if request.query_params.get("unread") in ("1", "true"):
            qs = qs.filter(read_at__isnull=True)
        limit = min(query_int(request, "limit") or 30, 100)
        return Response(self.get_serializer(qs.order_by("-created_at", "-id")[:limit], many=True).data)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    @extend_schema(request=None, responses=UnreadCountSerializer)
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"unread": 0})

    @extend_schema(responses=UnreadCountSerializer)
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"unread": self.get_queryset().filter(read_at__isnull=True).count()})
