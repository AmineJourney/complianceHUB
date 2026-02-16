from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ComplianceResultViewSet, ComplianceGapViewSet,
    FrameworkAdoptionViewSet, ComplianceReportViewSet
)

router = DefaultRouter()
router.register(r'results', ComplianceResultViewSet, basename='compliance-result')
router.register(r'gaps', ComplianceGapViewSet, basename='compliance-gap')
router.register(r'adoptions', FrameworkAdoptionViewSet, basename='framework-adoption')
router.register(r'reports', ComplianceReportViewSet, basename='compliance-report')

urlpatterns = [
    path('', include(router.urls)),
]