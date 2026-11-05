from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    ChangePasswordSerializer,
    DetailSerializer,
    EmailTokenObtainPairSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({"user": UserSerializer(user).data, **tokens_for(user)}, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    throttle_scope = "auth"


class LogoutView(APIView):
    """Blacklist the refresh token so it can no longer mint access tokens."""

    @extend_schema(request=LogoutSerializer, responses={204: None})
    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"refresh": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh)
            if str(token["user_id"]) != str(request.user.pk):
                return Response({"detail": "Token does not belong to this user."}, status=status.HTTP_400_BAD_REQUEST)
            token.blacklist()
        except TokenError:
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    @extend_schema(request=ChangePasswordSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["current_password"]):
            return Response({"current_password": ["Current password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(serializer.validated_data["new_password"], user=user)
        except DjangoValidationError as exc:
            return Response({"new_password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"

    @extend_schema(request=PasswordResetRequestSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            send_mail(
                subject="Reset your TeamFlow password",
                message=(
                    f"Hi {user.full_name},\n\n"
                    f"Use the link below to choose a new password:\n{link}\n\n"
                    "If you didn't request this, you can ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
            )
        # Same response either way so the endpoint can't be used to discover accounts.
        return Response({"detail": "If an account exists for that email, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"

    @extend_schema(request=PasswordResetConfirmSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(data["uid"])))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None
        if user is None or not default_token_generator.check_token(user, data["token"]):
            return Response({"detail": "This reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(data["new_password"], user=user)
        except DjangoValidationError as exc:
            return Response({"new_password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Your password has been reset. You can now log in."})
