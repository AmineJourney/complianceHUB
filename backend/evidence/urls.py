from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EvidenceViewSet, AppliedControlEvidenceViewSet,
    EvidenceCommentViewSet
)

router = DefaultRouter()
router.register(r'evidence', EvidenceViewSet, basename='evidence')
router.register(r'control-evidence-links', AppliedControlEvidenceViewSet, basename='control-evidence-link')
router.register(r'comments', EvidenceCommentViewSet, basename='evidence-comment')

urlpatterns = [
    path('', include(router.urls)),
]