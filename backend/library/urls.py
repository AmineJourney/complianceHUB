from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StoredLibraryViewSet, LoadedLibraryViewSet,
    FrameworkViewSet, RequirementViewSet
)

router = DefaultRouter()
router.register(r'stored-libraries', StoredLibraryViewSet, basename='stored-library')
router.register(r'loaded-libraries', LoadedLibraryViewSet, basename='loaded-library')
router.register(r'frameworks', FrameworkViewSet, basename='framework')
router.register(r'requirements', RequirementViewSet, basename='requirement')

urlpatterns = [
    path('', include(router.urls)),
]