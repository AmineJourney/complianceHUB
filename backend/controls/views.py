from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from core.permissions import IsTenantMember, TenantObjectPermission, RolePermission
from .models import (
    ReferenceControl, AppliedControl,
    RequirementReferenceControl, ControlException
)
from .serializers import (
    ReferenceControlSerializer, ReferenceControlListSerializer,
    AppliedControlSerializer, AppliedControlListSerializer,
    RequirementReferenceControlSerializer, ControlExceptionSerializer,
    ControlCoverageSerializer, ControlDashboardSerializer
)
from .services import ControlApplicationService, ControlAnalyticsService


class ReferenceControlViewSet(viewsets.ModelViewSet):
    """
    Reference control management
    Read-only for regular users, admin-only for modifications
    """
    queryset = ReferenceControl.objects.all()
    serializer_class = ReferenceControlSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        'control_family', 'control_type', 'automation_level',
        'priority', 'is_published'
    ]
    search_fields = ['code', 'name', 'description', 'tags']
    ordering_fields = ['code', 'name', 'priority', 'created_at']
    ordering = ['code']
    
    def get_queryset(self):
        """Filter to show only published controls for non-admin users"""
        qs = super().get_queryset().filter(is_deleted=False)
        
        if not self.request.user.is_staff:
            qs = qs.filter(is_published=True)
        
        return qs
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ReferenceControlListSerializer
        return ReferenceControlSerializer
    
    def get_permissions(self):
        """Only admins can modify reference controls"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=True, methods=['get'])
    def requirements(self, request, pk=None):
        """Get all requirements mapped to this control"""
        control = self.get_object()
        mappings = control.requirement_mappings.filter(is_deleted=False)
        serializer = RequirementReferenceControlSerializer(mappings, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def applied_instances(self, request, pk=None):
        """Get all applied instances of this control"""
        control = self.get_object()
        
        # For admins, show all; for users, show only their company's
        instances = control.applied_instances.filter(is_deleted=False)
        if hasattr(request, 'tenant'):
            instances = instances.filter(company=request.tenant)
        
        serializer = AppliedControlListSerializer(instances, many=True)
        return Response(serializer.data)


class AppliedControlViewSet(viewsets.ModelViewSet):
    """Applied control management for companies"""
    
    serializer_class = AppliedControlSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission, RolePermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        'status', 'department', 'control_owner', 'has_deficiencies',
        'reference_control__control_family', 'reference_control__control_type'
    ]
    search_fields = [
        'reference_control__code', 'reference_control__name',
        'implementation_notes', 'custom_procedures'
    ]
    ordering_fields = [
        'reference_control__code', 'status', 'effectiveness_rating',
        'next_review_date', 'created_at'
    ]
    ordering = ['reference_control__code']
    
    def get_queryset(self):
        """Get controls for current company"""
        if hasattr(self.request, 'tenant'):
            return AppliedControl.objects.for_company(
                self.request.tenant
            ).select_related(
                'reference_control', 'department', 'control_owner'
            )
        return AppliedControl.objects.none()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return AppliedControlListSerializer
        return AppliedControlSerializer
    
    def perform_create(self, serializer):
        """Set company from request"""
        serializer.save(company=self.request.tenant)
    
    @action(detail=False, methods=['post'])
    def apply_control(self, request):
        """Apply a reference control to the company"""
        reference_control_id = request.data.get('reference_control')
        department_id = request.data.get('department')
        control_owner_id = request.data.get('control_owner')
        
        if not reference_control_id:
            return Response(
                {'error': 'reference_control is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            reference_control = ReferenceControl.objects.get(
                id=reference_control_id,
                is_published=True,
                is_deleted=False
            )
        except ReferenceControl.DoesNotExist:
            return Response(
                {'error': 'Reference control not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get optional department
        department = None
        if department_id:
            from organizations.models import Department
            try:
                department = Department.objects.get(
                    id=department_id,
                    company=request.tenant
                )
            except Department.DoesNotExist:
                return Response(
                    {'error': 'Department not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Get optional control owner
        control_owner = None
        if control_owner_id:
            from core.models import User
            try:
                control_owner = User.objects.get(id=control_owner_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Apply control
        applied_control = ControlApplicationService.apply_control(
            company=request.tenant,
            reference_control=reference_control,
            department=department,
            control_owner=control_owner,
            **request.data
        )
        
        serializer = AppliedControlSerializer(applied_control)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def apply_framework_controls(self, request):
        """Apply all controls for a framework"""
        framework_id = request.data.get('framework')
        department_id = request.data.get('department')
        
        if not framework_id:
            return Response(
                {'error': 'framework is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from library.models import Framework
            framework = Framework.objects.get(
                id=framework_id,
                is_published=True,
                is_deleted=False
            )
        except Framework.DoesNotExist:
            return Response(
                {'error': 'Framework not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get optional department
        department = None
        if department_id:
            from organizations.models import Department
            department = Department.objects.get(
                id=department_id,
                company=request.tenant
            )
        
        # Apply controls
        applied_controls = ControlApplicationService.apply_controls_for_framework(
            company=request.tenant,
            framework=framework,
            department=department
        )
        
        return Response({
            'message': f'Applied {len(applied_controls)} controls',
            'applied_count': len(applied_controls)
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def coverage(self, request, pk=None):
        """Get control coverage for requirements"""
        applied_control = self.get_object()
        
        # Get requirement coverage
        mappings = RequirementReferenceControl.objects.filter(
            reference_control=applied_control.reference_control,
            validation_status='validated',
            is_deleted=False
        ).select_related('requirement')
        
        coverage_data = []
        for mapping in mappings:
            coverage = ControlApplicationService.get_control_coverage_for_requirement(
                company=request.tenant,
                requirement=mapping.requirement
            )
            coverage_data.append({
                'requirement': mapping.requirement.code,
                'coverage': coverage
            })
        
        return Response(coverage_data)
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get control dashboard metrics"""
        dashboard_data = ControlAnalyticsService.get_company_control_dashboard(
            company=request.tenant
        )
        serializer = ControlDashboardSerializer(dashboard_data)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def effectiveness_metrics(self, request):
        """Get control effectiveness metrics"""
        metrics = ControlAnalyticsService.get_control_effectiveness_metrics(
            company=request.tenant
        )
        return Response(metrics)
    
    @action(detail=False, methods=['get'])
    def overdue_reviews(self, request):
        """Get controls with overdue reviews"""
        from django.utils import timezone
        
        overdue = self.get_queryset().filter(
            next_review_date__lt=timezone.now().date()
        )
        serializer = AppliedControlListSerializer(overdue, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def with_deficiencies(self, request):
        """Get controls with deficiencies"""
        deficient = self.get_queryset().filter(has_deficiencies=True)
        serializer = AppliedControlListSerializer(deficient, many=True)
        return Response(serializer.data)


class RequirementReferenceControlViewSet(viewsets.ModelViewSet):
    """
    Requirement-control mapping management
    Admin-only for modifications
    """
    queryset = RequirementReferenceControl.objects.all()
    serializer_class = RequirementReferenceControlSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = [
        'requirement', 'reference_control', 'coverage_level',
        'is_primary', 'validation_status'
    ]
    ordering_fields = ['requirement__code', 'reference_control__code']
    ordering = ['requirement__code']
    
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False).select_related(
            'requirement', 'reference_control'
        )
    
    def get_permissions(self):
        """Only admins can modify mappings"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def validate_mapping(self, request, pk=None):
        """Validate a requirement-control mapping"""
        mapping = self.get_object()
        
        from django.utils import timezone
        mapping.validation_status = 'validated'
        mapping.validated_by = request.user
        mapping.validated_at = timezone.now()
        mapping.save()
        
        return Response({'message': 'Mapping validated successfully'})


class ControlExceptionViewSet(viewsets.ModelViewSet):
    """Control exception management"""
    
    serializer_class = ControlExceptionSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['applied_control', 'exception_type', 'is_active']
    ordering_fields = ['created_at', 'expiration_date']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Get exceptions for current company"""
        if hasattr(self.request, 'tenant'):
            return ControlException.objects.for_company(
                self.request.tenant
            ).select_related('applied_control', 'accepted_by')
        return ControlException.objects.none()
    
    def perform_create(self, serializer):
        """Set company from request"""
        serializer.save(company=self.request.tenant)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept/approve an exception"""
        exception = self.get_object()
        
        from django.utils import timezone
        exception.accepted_by = request.user
        exception.accepted_at = timezone.now()
        exception.is_active = True
        exception.save()
        
        return Response({'message': 'Exception accepted'})
    
    @action(detail=False, methods=['get'])
    def expired(self, request):
        """Get expired exceptions"""
        from django.utils import timezone
        
        expired = self.get_queryset().filter(
            expiration_date__lt=timezone.now().date(),
            is_active=True
        )
        serializer = self.get_serializer(expired, many=True)
        return Response(serializer.data)