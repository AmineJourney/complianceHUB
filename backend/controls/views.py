from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from core.permissions import IsTenantMember, TenantObjectPermission, RolePermission
from .models import (
    ReferenceControl, AppliedControl,
    RequirementReferenceControl, ControlException, UnifiedControl, UnifiedControlMapping
)
from .serializers import (
    ReferenceControlSerializer, ReferenceControlListSerializer,
    AppliedControlSerializer, AppliedControlListSerializer,
    RequirementReferenceControlSerializer, ControlExceptionSerializer,
    ControlCoverageSerializer, ControlDashboardSerializer,
    UnifiedControlSerializer, UnifiedControlMappingSerializer
)
from .services import ControlApplicationService, ControlAnalyticsService


class ReferenceControlViewSet(viewsets.ModelViewSet):
    """Reference control management — read-only for users, admin-only for writes."""

    queryset = ReferenceControl.objects.all()
    serializer_class = ReferenceControlSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        'control_family', 'control_type', 'automation_level', 'priority', 'is_published'
    ]
    search_fields = ['code', 'name', 'description', 'tags']
    ordering_fields = ['code', 'name', 'priority', 'created_at']
    ordering = ['code']

    def get_queryset(self):
        qs = super().get_queryset().filter(is_deleted=False)
        if not self.request.user.is_staff:
            qs = qs.filter(is_published=True)

        # Filter by framework code — e.g. ?framework=ISO27001-2022
        framework = self.request.query_params.get("framework")
        if framework:
            qs = qs.filter(
                requirement_mappings__requirement__framework__code=framework,
                requirement_mappings__is_deleted=False,
            ).distinct()

        # Filter by StoredLibrary name — e.g. ?library=TISAX
        library = self.request.query_params.get("library")
        if library:
            qs = qs.filter(
                requirement_mappings__requirement__framework__loaded_library__stored_library__name=library,
                requirement_mappings__is_deleted=False,
            ).distinct()

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ReferenceControlListSerializer
        return ReferenceControlSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'])
    def requirements(self, request, pk=None):
        """Get all requirements mapped to this control."""
        control = self.get_object()
        mappings = control.requirement_mappings.filter(is_deleted=False)
        serializer = RequirementReferenceControlSerializer(mappings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def applied_instances(self, request, pk=None):
        """Get all applied instances of this control for the current company."""
        control = self.get_object()
        instances = control.applied_instances.filter(is_deleted=False)
        if hasattr(request, 'tenant'):
            instances = instances.filter(company=request.tenant)
        serializer = AppliedControlListSerializer(instances, many=True)
        return Response(serializer.data)



class UnifiedControlViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Unified Control Library
    
    Read-only access to the internal unified control library.
    These are the controls your company implements to satisfy multiple frameworks.
    """
    queryset = UnifiedControl.objects.filter(is_active=True)
    serializer_class = UnifiedControlSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by domain
        domain = self.request.query_params.get('domain')
        if domain:
            queryset = queryset.filter(domain=domain)
        
        # Filter by tags
        tags = self.request.query_params.getlist('tags')
        if tags:
            queryset = queryset.filter(tags__contains=tags)
        
        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(control_name__icontains=search) |
                Q(description__icontains=search) |
                Q(control_code__icontains=search)
            )
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def framework_coverage(self, request, pk=None):
        """
        Get all frameworks this unified control satisfies
        """
        unified_control = self.get_object()
        coverage = unified_control.get_framework_coverage()
        
        return Response(coverage)
    
    @action(detail=True, methods=['get'])
    def implementations(self, request, pk=None):
        """
        Get all company implementations of this unified control
        (Admin/Owner only)
        """
        unified_control = self.get_object()
        company = request.tenant  # From TenantMiddleware
        
        implementations = AppliedControl.objects.filter(
            company=company,
            unified_control=unified_control,
            is_deleted=False
        )
        
        serializer = AppliedControlSerializer(implementations, many=True)
        return Response(serializer.data)


class AppliedControlViewSet(viewsets.ModelViewSet):
    """
    Applied Controls - Company implementations
    ENHANCED with maturity tracking
    """
    serializer_class = AppliedControlSerializer
    
    def get_queryset(self):
        company = self.request.tenant
        queryset = AppliedControl.objects.filter(
            company=company,
            is_deleted=False
        ).select_related(
            'reference_control',
            'unified_control',
            'control_owner',
            'department'
        )
        
        # Filter by maturity level
        maturity = self.request.query_params.get('maturity_level')
        if maturity:
            queryset = queryset.filter(maturity_level=maturity)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def assess_maturity(self, request, pk=None):
        """
        Assess and update maturity level for a control
        
        Request body:
        {
          "maturity_level": 3,
          "maturity_notes": "Processes well documented and followed"
        }
        """
        applied_control = self.get_object()
        
        maturity_level = request.data.get('maturity_level')
        maturity_notes = request.data.get('maturity_notes', '')
        
        if maturity_level not in [1, 2, 3, 4, 5]:
            return Response(
                {'error': 'maturity_level must be 1-5'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        applied_control.maturity_level = maturity_level
        applied_control.maturity_notes = maturity_notes
        applied_control.maturity_assessment_date = timezone.now().date()
        applied_control.save()
        
        serializer = self.get_serializer(applied_control)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def maturity_summary(self, request):
        """
        Get maturity level summary for all controls
        """
        company = request.tenant
        
        summary = AppliedControl.objects.filter(
            company=company,
            is_deleted=False
        ).values('maturity_level').annotate(
            count=Count('id')
        ).order_by('maturity_level')
        
        return Response({
            'maturity_distribution': list(summary),
            'average_maturity': AppliedControl.objects.filter(
                company=company,
                is_deleted=False
            ).aggregate(avg=Avg('maturity_level'))['avg']
        })

class RequirementReferenceControlViewSet(viewsets.ModelViewSet):
    """Requirement-control mapping management — admin-only for writes."""

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
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def validate_mapping(self, request, pk=None):
        """Validate a requirement-control mapping."""
        mapping = self.get_object()
        from django.utils import timezone
        mapping.validation_status = "validated"
        mapping.validated_by = request.user
        mapping.validated_at = timezone.now()
        mapping.save()
        return Response({"message": "Mapping validated successfully"})


class ControlExceptionViewSet(viewsets.ModelViewSet):
    """Control exception management."""

    serializer_class = ControlExceptionSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['applied_control', 'exception_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        if hasattr(self.request, 'tenant'):
            return ControlException.objects.filter(
                company=self.request.tenant,
                is_deleted=False
            ).select_related('applied_control', 'accepted_by')
        return ControlException.objects.none()

    def perform_create(self, serializer):
        serializer.save(company=self.request.tenant)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept/approve an exception."""
        exception = self.get_object()
        from django.utils import timezone
        exception.accepted_by = request.user
        exception.accepted_at = timezone.now()
        exception.is_active = True
        exception.save()
        return Response({'message': 'Exception accepted'})

    @action(detail=False, methods=['get'])
    def expired(self, request):
        """Get expired exceptions."""
        from django.utils import timezone
        expired = self.get_queryset().filter(
            expiration_date__lt=timezone.now().date(),
            is_active=True
        )
        serializer = self.get_serializer(expired, many=True)
        return Response(serializer.data)