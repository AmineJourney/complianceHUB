from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import IsTenantMember, TenantObjectPermission
from .models import Department
from .serializers import DepartmentSerializer, DepartmentTreeSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    """Department CRUD with hierarchy support"""
    
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['parent']
    search_fields = ['name', 'code', 'description']
    
    def get_queryset(self):
        """Get departments for current company"""
        if hasattr(self.request, 'tenant'):
            return Department.objects.for_company(self.request.tenant).select_related(
                'parent', 'manager', 'company'
            )
        return Department.objects.none()
    
    def perform_create(self, serializer):
        """Set company from request"""
        serializer.save(company=self.request.tenant)
    
    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Get department hierarchy as tree"""
        # Get root departments (no parent)
        roots = self.get_queryset().filter(parent__isnull=True)
        serializer = DepartmentTreeSerializer(roots, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def ancestors(self, request, pk=None):
        """Get all ancestor departments"""
        department = self.get_object()
        ancestors = department.get_ancestors()
        serializer = DepartmentSerializer(ancestors, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def descendants(self, request, pk=None):
        """Get all descendant departments"""
        department = self.get_object()
        descendants = department.get_descendants()
        serializer = DepartmentSerializer(descendants, many=True)
        return Response(serializer.data)