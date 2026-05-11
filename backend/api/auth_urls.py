from django.urls import path
from .auth_views import (
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    ProfileView,
    ChangePasswordView,
    ConnectWalletView,
    TokenRefreshView,
    AdminChangeRoleView,
    AdminResetPasswordView,
)

urlpatterns = [
    path("register/",             RegisterView.as_view(),          name="auth-register"),
    path("login/",                LoginView.as_view(),             name="auth-login"),
    path("logout/",               LogoutView.as_view(),            name="auth-logout"),
    path("token/refresh/",        TokenRefreshView.as_view(),      name="auth-token-refresh"),
    path("me/",                   MeView.as_view(),                name="auth-me"),
    path("profile/",              ProfileView.as_view(),           name="auth-profile"),
    path("change-password/",      ChangePasswordView.as_view(),    name="auth-change-password"),
    path("connect-wallet/",       ConnectWalletView.as_view(),     name="auth-connect-wallet"),
    path("admin/change-role/",    AdminChangeRoleView.as_view(),   name="auth-admin-change-role"),
    path("admin/reset-password/", AdminResetPasswordView.as_view(),name="auth-admin-reset-password"),
]