from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RiskMatrixViewSet, RiskViewSet, RiskAssessmentViewSet,
    RiskEventViewSet, RiskTreatmentActionViewSet
)

router = DefaultRouter()
router.register(r'matrices', RiskMatrixViewSet, basename='risk-matrix')
router.register(r'risks', RiskViewSet, basename='risk')
router.register(r'assessments', RiskAssessmentViewSet, basename='risk-assessment')
router.register(r'events', RiskEventViewSet, basename='risk-event')
router.register(r'treatment-actions', RiskTreatmentActionViewSet, basename='treatment-action')

urlpatterns = [
    path('', include(router.urls)),
]