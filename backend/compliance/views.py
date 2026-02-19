from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from core.permissions import IsTenantMember, TenantObjectPermission, RolePermission
from .models import (
    ComplianceResult, ComplianceGap, FrameworkAdoption, ComplianceReport
)
from .serializers import (
    ComplianceResultSerializer, ComplianceResultListSerializer,
    ComplianceGapSerializer, FrameworkAdoptionSerializer,
    ComplianceReportSerializer, ComplianceOverviewSerializer,
    ComplianceTrendSerializer, GapAnalysisSerializer,
    RecommendationSerializer
)
from .services import (
    ComplianceCalculationService, ComplianceAnalyticsService,
    ComplianceRecommendationService
)


class ComplianceResultViewSet(viewsets.ModelViewSet):
    """Compliance result management and calculation"""
    
    serializer_class = ComplianceResultSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['framework', 'department', 'is_current', 'status']
    ordering_fields = ['calculation_date', 'compliance_score', 'coverage_percentage']
    ordering = ['-calculation_date']
    
    def get_queryset(self):
        """Get compliance results for current company"""
        if hasattr(self.request, 'tenant'):
            return ComplianceResult.objects.for_company(
                self.request.tenant
            ).select_related(
                'framework', 'department', 'calculated_by'
            )
        return ComplianceResult.objects.none()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ComplianceResultListSerializer
        return ComplianceResultSerializer
    
    def create(self, request, *args, **kwargs):
        """Not allowed - use calculate action instead"""
        return Response(
            {'error': 'Use POST /calculate/ to trigger compliance calculation'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )
    
    @action(detail=False, methods=['post'])
    def calculate(self, request):
        """
        Calculate compliance for a framework
        POST /api/compliance/results/calculate/
        Body: {"framework": "uuid", "department": "uuid" (optional)}
        """
        framework_id = request.data.get('framework')
        department_id = request.data.get('department')
        
        if not framework_id:
            return Response(
                {'error': 'framework is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get framework
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
            try:
                department = Department.objects.get(
                    id=department_id,
                    company=request.tenant,
                    is_deleted=False
                )
            except Department.DoesNotExist:
                return Response(
                    {'error': 'Department not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Calculate compliance
        try:
            result = ComplianceCalculationService.calculate_framework_compliance(
                company=request.tenant,
                framework=framework,
                department=department,
                user=request.user
            )
            
            serializer = ComplianceResultSerializer(result)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Calculation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def calculate_all(self, request):
        """Calculate compliance for all adopted frameworks"""
        try:
            results = ComplianceCalculationService.calculate_all_frameworks(
                company=request.tenant
            )
            
            return Response({
                'message': f'Calculated compliance for {len(results)} frameworks',
                'results': [
                    {
                        'framework': r.framework.code,
                        'score': float(r.compliance_score),
                        'grade': r.get_compliance_grade()
                    }
                    for r in results
                ]
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Calculation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        """Get detailed compliance breakdown"""
        result = self.get_object()
        serializer = ComplianceResultSerializer(result)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def requirement_breakdown(self, request, pk=None):
        """Get requirement-level breakdown"""
        result = self.get_object()
        return Response(result.requirement_details)
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current compliance results for all frameworks"""
        results = self.get_queryset().filter(is_current=True)
        serializer = ComplianceResultListSerializer(results, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overview(self, request):
        """Get compliance overview dashboard"""
        overview = ComplianceAnalyticsService.get_company_compliance_overview(
            company=request.tenant
        )
        serializer = ComplianceOverviewSerializer(overview)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def trends(self, request):
        """
        Get compliance trends over time
        Query params: framework (required), months (optional, default 12)
        """
        framework_id = request.query_params.get('framework')
        months = int(request.query_params.get('months', 12))
        
        if not framework_id:
            return Response(
                {'error': 'framework parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from library.models import Framework
            framework = Framework.objects.get(id=framework_id)
        except Framework.DoesNotExist:
            return Response(
                {'error': 'Framework not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        trends = ComplianceAnalyticsService.get_compliance_trends(
            company=request.tenant,
            framework=framework,
            months=months
        )
        
        return Response(trends)
    
    @action(detail=False, methods=['get'])
    def gap_analysis(self, request):
        """
        Get gap analysis for a framework
        Query params: framework (required)
        """
        framework_id = request.query_params.get('framework')
        
        if not framework_id:
            return Response(
                {'error': 'framework parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from library.models import Framework
            framework = Framework.objects.get(id=framework_id)
        except Framework.DoesNotExist:
            return Response(
                {'error': 'Framework not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        gap_analysis = ComplianceAnalyticsService.get_gap_analysis(
            company=request.tenant,
            framework=framework
        )
        
        serializer = GapAnalysisSerializer(gap_analysis)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def recommendations(self, request):
        """
        Get prioritized compliance recommendations
        Query params: framework (required)
        """
        framework_id = request.query_params.get('framework')
        
        if not framework_id:
            return Response(
                {'error': 'framework parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from library.models import Framework
            framework = Framework.objects.get(id=framework_id)
        except Framework.DoesNotExist:
            return Response(
                {'error': 'Framework not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        recommendations = ComplianceRecommendationService.get_prioritized_actions(
            company=request.tenant,
            framework=framework
        )
        
        return Response(recommendations)


class ComplianceGapViewSet(viewsets.ModelViewSet):
    """Compliance gap management"""
    
    serializer_class = ComplianceGapSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['compliance_result', 'requirement', 'gap_type', 'severity', 'status']
    search_fields = ['description', 'remediation_plan']
    ordering_fields = ['severity', 'remediation_due_date', 'created_at']
    ordering = ['-severity', 'remediation_due_date']
    
    def get_queryset(self):
        """Get gaps for current company"""
        if hasattr(self.request, 'tenant'):
            return ComplianceGap.objects.for_company(
                self.request.tenant
            ).select_related(
                'compliance_result', 'requirement', 'remediation_owner'
            ).prefetch_related('affected_controls')
        return ComplianceGap.objects.none()
    
    def perform_create(self, serializer):
        """Set company from request"""
        serializer.save(company=self.request.tenant)
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Mark gap as resolved"""
        gap = self.get_object()
        
        from django.utils import timezone
        gap.status = 'resolved'
        gap.resolved_at = timezone.now()
        gap.resolved_by = request.user
        gap.resolution_notes = request.data.get('notes', '')
        gap.save()
        
        serializer = self.get_serializer(gap)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def accept_risk(self, request, pk=None):
        """Accept risk for this gap"""
        gap = self.get_object()
        
        gap.status = 'accepted'
        gap.save()
        
        serializer = self.get_serializer(gap)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def open(self, request):
        """Get all open gaps"""
        open_gaps = self.get_queryset().filter(status='open')
        serializer = self.get_serializer(open_gaps, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get gaps with overdue remediation dates"""
        from django.utils import timezone
        
        overdue_gaps = self.get_queryset().filter(
            remediation_due_date__lt=timezone.now().date(),
            status__in=['open', 'in_progress']
        )
        serializer = self.get_serializer(overdue_gaps, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_severity(self, request):
        """Get gaps grouped by severity"""
        from django.db.models import Count
        
        by_severity = self.get_queryset().values('severity').annotate(
            count=Count('id')
        ).order_by('severity')
        
        return Response(list(by_severity))


class FrameworkAdoptionViewSet(viewsets.ModelViewSet):
    """Framework adoption management"""
    
    serializer_class = FrameworkAdoptionSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission, RolePermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['framework', 'adoption_status', 'is_certified']
    ordering_fields = ['created_at', 'target_completion_date', 'certification_expiry_date']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Get adoptions for current company"""
        if hasattr(self.request, 'tenant'):
            return FrameworkAdoption.objects.for_company(
                self.request.tenant
            ).select_related('framework', 'program_owner')
        return FrameworkAdoption.objects.none()
    
    def perform_create(self, serializer):
        """Set company from request"""
        serializer.save(company=self.request.tenant)
    
    @action(detail=False, methods=['post'])
    def adopt_framework(self, request):
        """Adopt a new framework"""
        framework_id = request.data.get('framework')
        print('Adopting framework:', request)
        if not framework_id:
            return Response(
                {'error': 'framework is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already adopted
        existing = FrameworkAdoption.objects.filter(
            company=request.tenant,
            framework_id=framework_id,
            is_deleted=False
        ).exists()
        
        if existing:
            return Response(
                {'error': 'Framework already adopted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get framework
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
        
        # Create adoption
        adoption = FrameworkAdoption.objects.create(
            company=request.tenant,
            framework=framework,
            adoption_status='planning',
            program_owner=request.user,
            **{k: v for k, v in request.data.items() if k not in ['framework']}
        )
        
        serializer = self.get_serializer(adoption)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def certify(self, request, pk=None):
        """Mark framework as certified"""
        adoption = self.get_object()
        
        from django.utils import timezone
        
        adoption.is_certified = True
        adoption.adoption_status = 'certified'
        adoption.certification_date = request.data.get('certification_date') or timezone.now().date()
        adoption.certification_body = request.data.get('certification_body', '')
        adoption.certification_expiry_date = request.data.get('certification_expiry_date')
        adoption.certificate_number = request.data.get('certificate_number', '')
        adoption.save()
        
        serializer = self.get_serializer(adoption)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active framework adoptions"""
        active = self.get_queryset().filter(
            adoption_status__in=['implementing', 'operational', 'certified']
        )
        serializer = self.get_serializer(active, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def certified(self, request):
        """Get certified frameworks"""
        certified = self.get_queryset().filter(is_certified=True)
        serializer = self.get_serializer(certified, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Get certifications expiring within 90 days"""
        from django.utils import timezone
        from datetime import timedelta
        
        threshold = timezone.now().date() + timedelta(days=90)
        
        expiring = self.get_queryset().filter(
            is_certified=True,
            certification_expiry_date__lte=threshold,
            certification_expiry_date__gte=timezone.now().date()
        )
        serializer = self.get_serializer(expiring, many=True)
        return Response(serializer.data)


class ComplianceReportViewSet(viewsets.ModelViewSet):
    """Compliance report generation and management"""
    
    serializer_class = ComplianceReportSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['framework', 'department', 'report_type', 'generation_status']
    ordering_fields = ['created_at', 'period_end']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Get reports for current company"""
        if hasattr(self.request, 'tenant'):
            return ComplianceReport.objects.for_company(
                self.request.tenant
            ).select_related('framework', 'department', 'generated_by')
        return ComplianceReport.objects.none()
    
    def perform_create(self, serializer):
        """Set company and generated_by"""
        serializer.save(
            company=self.request.tenant,
            generated_by=self.request.user
        )
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generate a compliance report
        This is a placeholder - actual report generation would be async
        """
        report_type = request.data.get('report_type', 'summary')
        framework_id = request.data.get('framework')
        title = request.data.get('title', f'Compliance Report - {report_type}')
        
        # Create report record
        report = ComplianceReport.objects.create(
            company=request.tenant,
            title=title,
            description=request.data.get('description', ''),
            framework_id=framework_id,
            department_id=request.data.get('department'),
            report_type=report_type,
            period_start=request.data.get('period_start'),
            period_end=request.data.get('period_end'),
            report_format=request.data.get('report_format', 'pdf'),
            generated_by=request.user,
            generation_status='pending'
        )
        
        # In production, trigger async task here to generate report
        # For now, just return the record
        
        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download generated report"""
        report = self.get_object()
        
        if not report.report_file:
            return Response(
                {'error': 'Report file not available'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        from django.http import FileResponse
        return FileResponse(
            report.report_file.open('rb'),
            as_attachment=True,
            filename=report.report_file.name.split('/')[-1]
        )