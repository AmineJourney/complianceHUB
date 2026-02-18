# core/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

# Create router for viewsets
router = DefaultRouter()
router.register(r'companies', views.CompanyViewSet, basename='company')
router.register(r'memberships', views.MembershipViewSet, basename='membership')

urlpatterns = [
    # JWT Authentication endpoints
    path('auth/token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', views.register, name='register'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/me/', views.current_user, name='current_user'),
    
    # Include router URLs (companies, memberships)
    path('', include(router.urls)),
]
