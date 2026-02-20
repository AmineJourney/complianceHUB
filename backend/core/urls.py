# core/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'companies', views.CompanyViewSet, basename='company')
router.register(r'memberships', views.MembershipViewSet, basename='membership')
router.register(r'invitations', views.InvitationViewSet, basename='invitation')

urlpatterns = [
    # JWT auth
    path('auth/token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', views.register, name='register'),
    path('auth/logout/', views.logout, name='logout'),

    # ✅ FIXED: single path handling both GET and PATCH via the view itself
    path('auth/me/', views.current_user, name='current_user'),
    path('auth/change-password/', views.change_password, name='change_password'),

    # Password reset (no auth required)
    path('auth/password-reset/', views.request_password_reset, name='password_reset_request'),
    path('auth/password-reset/confirm/', views.confirm_password_reset, name='password_reset_confirm'),
    path('auth/password-reset/validate/', views.validate_reset_token, name='password_reset_validate'),

    # Router URLs (companies, memberships, invitations)
    path('', include(router.urls)),
]