from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password

from .models import User, CreditWallet, AuditLog
from .serializers import (
    UserRegisterSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
    ChangePasswordSerializer,
    WalletConnectSerializer,
    AdminUserSerializer,
)
from .permissions import IsAdminRole


def get_tokens_for_user(user):
    """Generate JWT token pair with custom claims."""
    refresh = RefreshToken.for_user(user)

    # Add custom claims to access token
    refresh.access_token["role"]           = user.role
    refresh.access_token["username"]       = user.username
    refresh.access_token["email"]          = user.email
    refresh.access_token["wallet_address"] = user.wallet_address or ""
    refresh.access_token["is_verified"]    = user.is_verified

    return {
        "access":  str(refresh.access_token),
        "refresh": str(refresh),
    }


def get_client_ip(request):
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ─────────────────────────────────────────────────────────────────────────────
#  Register
# ─────────────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user   = serializer.save()
            tokens = get_tokens_for_user(user)
            return Response({
                "message": "Account created successfully.",
                "user":    UserProfileSerializer(user).data,
                "tokens":  tokens,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────────────────────
#  Login
# ─────────────────────────────────────────────────────────────────────────────

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=username, password=password)

        if not user:
            return Response(
                {"error": "Invalid username or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"error": "Account is suspended. Contact admin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        tokens = get_tokens_for_user(user)
        return Response({
            "message": "Login successful.",
            "user":    UserProfileSerializer(user).data,
            "tokens":  tokens,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
#  Logout
# ─────────────────────────────────────────────────────────────────────────────

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"message": "Logged out successfully."},
                status=status.HTTP_200_OK,
            )
        except TokenError:
            return Response(
                {"error": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ─────────────────────────────────────────────────────────────────────────────
#  Me + Profile
# ─────────────────────────────────────────────────────────────────────────────

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "id":             str(request.user.id),
            "username":       request.user.username,
            "role":           request.user.role,
            "is_verified":    request.user.is_verified,
            "wallet_address": request.user.wallet_address,
        })


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Profile updated.",
                "user":    UserProfileSerializer(request.user).data,
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────────────────────
#  Change Password
# ─────────────────────────────────────────────────────────────────────────────

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"message": "Password changed successfully."})


# ─────────────────────────────────────────────────────────────────────────────
#  Connect Wallet
# ─────────────────────────────────────────────────────────────────────────────

class ConnectWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletConnectSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        request.user.wallet_address = serializer.validated_data["wallet_address"]
        request.user.save()
        return Response({
            "message":        "Wallet connected successfully.",
            "wallet_address": request.user.wallet_address,
        })


# ─────────────────────────────────────────────────────────────────────────────
#  Token Refresh (handled by simplejwt but wrapped for consistency)
# ─────────────────────────────────────────────────────────────────────────────

class TokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            refresh = RefreshToken(refresh_token)
            user_id = refresh.payload.get("user_id")
            user    = User.objects.get(id=user_id)

            # Refresh custom claims
            refresh.access_token["role"]           = user.role
            refresh.access_token["username"]       = user.username
            refresh.access_token["is_verified"]    = user.is_verified
            refresh.access_token["wallet_address"] = user.wallet_address or ""

            return Response({
                "access":  str(refresh.access_token),
                "refresh": str(refresh),
            })
        except (TokenError, User.DoesNotExist):
            return Response(
                {"error": "Invalid or expired refresh token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )


# ─────────────────────────────────────────────────────────────────────────────
#  Admin — Change Role
# ─────────────────────────────────────────────────────────────────────────────

class AdminChangeRoleView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        user_id  = request.data.get("user_id")
        new_role = request.data.get("role")

        valid_roles = ["consumer", "producer", "both", "admin"]
        if new_role not in valid_roles:
            return Response(
                {"error": f"Role must be one of: {valid_roles}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        old_role   = user.role
        user.role  = new_role
        user.save()

        # Audit log
        AuditLog.objects.create(
            admin=request.user,
            action="change_role",
            target_model="User",
            target_id=str(user.id),
            details={"old_role": old_role, "new_role": new_role},
            ip_address=get_client_ip(request),
        )

        return Response({
            "message":  f"Role updated to {new_role}.",
            "user":     AdminUserSerializer(user).data,
        })


# ─────────────────────────────────────────────────────────────────────────────
#  Admin — Reset Password
# ─────────────────────────────────────────────────────────────────────────────

class AdminResetPasswordView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        user_id      = request.data.get("user_id")
        new_password = request.data.get("new_password")

        if not new_password or len(new_password) < 8:
            return Response(
                {"error": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user.set_password(new_password)
        user.save()

        # Audit log
        AuditLog.objects.create(
            admin=request.user,
            action="reset_password",
            target_model="User",
            target_id=str(user.id),
            details={"reset_by": request.user.username},
            ip_address=get_client_ip(request),
        )

        return Response({"message": "Password reset successfully."})

class UnlinkWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.wallet_address = None
        request.user.save()
        return Response({"message": "Wallet unlinked."})