from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True, default=None)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "actor",
            "organization",
            "organization_name",
            "project",
            "task",
            "verb",
            "message",
            "link",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_is_read(self, obj) -> bool:
        return obj.read_at is not None


class UnreadCountSerializer(serializers.Serializer):
    unread = serializers.IntegerField(read_only=True)
