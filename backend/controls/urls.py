from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReferenceControlViewSet, AppliedControlViewSet,
    RequirementReferenceControlViewSet, ControlExceptionViewSet
)

router = DefaultRouter()
router.register(r'reference-controls', ReferenceControlViewSet, basename='reference-control')
router.register(r'applied-controls', AppliedControlViewSet, basename='applied-control')
router.register(r'requirement-mappings', RequirementReferenceControlViewSet, basename='requirement-mapping')
router.register(r'exceptions', ControlExceptionViewSet, basename='control-exception')

urlpatterns = [
    path('', include(router.urls)),
]