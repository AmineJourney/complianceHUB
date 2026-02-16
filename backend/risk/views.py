from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from core.permissions import IsTenantMember, TenantObjectPermission, RolePermission
from .models import (
    RiskMatrix, Risk, RiskAssessment, RiskEvent, RiskTreatmentAction
)
from .serializers import (
    RiskMatrixSerializer, RiskSerializer, RiskListSerializer,
    RiskAssessmentSerializer, RiskEventSerializer,
    RiskTreatmentActionSerializer, RiskRegisterSummarySerializer,
    RiskHeatMapSerializer, TopRisksSerializer, RiskTrendSerializer,
    RiskTreatmentPrioritySerializer
)
from .services import (
    RiskCalculationService, RiskAnalyticsService,
    RiskRecommendationService
)


class RiskMatrixViewSet(viewsets.ModelViewSet):
    """Risk matrix management"""
    
    serializer_class = RiskMatrixSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission, RolePermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_active']
    ordering = ['-is_active', '-created_at']
    
    def get_queryset(self):
        """Get risk matrices for current company"""
        if hasattr(self.request, 'tenant'):
            return RiskMatrix.objects.for_company(
                self.request.tenant
            )
        return RiskMatrix.objects.none()
    
    def perform_create(self, serializer):
        """Set company from request"""
        serializer.save(company=self.request.tenant)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate this risk matrix"""
        matrix = self.get_object()
        
        try:
            matrix.activate()
            return Response({
                'message': f'{matrix.name} activated successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def create_default(self, request):
        """Create a default 5x5 risk matrix"""
        # Check if active matrix already exists
        existing = RiskMatrix.objects.filter(
            company=request.tenant,
            is_active=True,
            is_deleted=False
        ).exists()
        
        if existing:
            return Response(
                {'error': 'An active risk matrix already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create default matrix
        matrix = RiskMatrix.create_default_5x5_matrix(company=request.tenant)
        
        serializer = self.get_serializer(matrix)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get the active risk matrix"""
        matrix = self.get_queryset().filter(is_active=True).first()
        
        if not matrix:
            return Response(
                {'error': 'No active risk matrix found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = self.get_serializer(matrix)
        return Response(serializer.data)


class RiskViewSet(viewsets.ModelViewSet):
    """Risk management"""
    
    serializer_class = RiskSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission, RolePermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        'risk_category', 'risk_source', 'inherent_risk_level',
        'status', 'risk_owner', 'department', 'treatment_strategy'
    ]
    search_fields = ['title', 'description', 'risk_id', 'tags']
    ordering_fields = [
        'inherent_risk_score', 'title', 'next_review_date', 'created_at'
    ]
    ordering = ['-inherent_risk_score']
    
    def get_queryset(self):
        """Get risks for current company"""
        if hasattr(self.request, 'tenant'):
            return Risk.objects.for_company(
                self.request.tenant
            ).select_related(
                'risk_matrix', 'risk_owner', 'department'
            )
        return Risk.objects.none()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return RiskListSerializer
        return RiskSerializer
    
    def perform_create(self, serializer):
        """Set company from request"""
        # Get or create default matrix if none provided
        risk_matrix = serializer.validated_data.get('risk_matrix')
        
        if not risk_matrix:
            risk_matrix = RiskMatrix.objects.filter(
                company=self.request.tenant,
                is_active=True,
                is_deleted=False
            ).first()
            
            if not risk_matrix:
                risk_matrix = RiskMatrix.create_default_5x5_matrix(
                    company=self.request.tenant
                )
        
        serializer.save(
            company=self.request.tenant,
            risk_matrix=risk_matrix
        )
    
    @action(detail=True, methods=['post'])
    def assess_with_control(self, request, pk=None):
        """
        Create a risk assessment linking a control to this risk
        POST /api/risk/risks/{id}/assess_with_control/
        Body: {
            "applied_control": "uuid",
            "effectiveness_rating": 75,
            "assessment_notes": "..."
        }
        """
        risk = self.get_object()
        
        control_id = request.data.get('applied_control')
        effectiveness_rating = request.data.get('effectiveness_rating', 50)
        
        if not control_id:
            return Response(
                {'error': 'applied_control is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get control
        try:
            from controls.models import AppliedControl
            control = AppliedControl.objects.get(
                id=control_id,
                company=request.tenant,
                is_deleted=False
            )
        except AppliedControl.DoesNotExist:
            return Response(
                {'error': 'Control not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create assessment
        try:
            assessment = RiskCalculationService.assess_risk_with_control(
                risk=risk,
                applied_control=control,
                effectiveness_rating=effectiveness_rating,
                user=request.user
            )
            
            # Add notes if provided
            if 'assessment_notes' in request.data:
                assessment.assessment_notes = request.data['assessment_notes']
                assessment.save()
            
            serializer = RiskAssessmentSerializer(assessment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def assessments(self, request, pk=None):
        """Get all assessments for this risk"""
        risk = self.get_object()
        assessments = risk.assessments.filter(is_deleted=False).order_by('-assessment_date')
        serializer = RiskAssessmentSerializer(assessments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def residual_risk(self, request, pk=None):
        """Get current residual risk calculation"""
        risk = self.get_object()
        residual = RiskCalculationService.calculate_aggregate_residual_risk(risk)
        return Response(residual)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get risk register summary"""
        summary = RiskAnalyticsService.get_risk_register_summary(
            company=request.tenant
        )
        serializer = RiskRegisterSummarySerializer(summary)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def heat_map(self, request):
        """Get risk heat map data"""
        heat_map = RiskAnalyticsService.get_risk_heat_map_data(
            company=request.tenant
        )
        serializer = RiskHeatMapSerializer(heat_map)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def top_risks(self, request):
        """Get top risks by inherent score"""
        limit = int(request.query_params.get('limit', 10))
        
        top_risks = RiskAnalyticsService.get_top_risks(
            company=request.tenant,
            limit=limit
        )
        
        return Response(top_risks)
    
    @action(detail=False, methods=['get'])
    def trends(self, request):
        """Get risk trends over time"""
        months = int(request.query_params.get('months', 12))
        
        trends = RiskAnalyticsService.get_risk_trends(
            company=request.tenant,
            months=months
        )
        
        return Response(trends)
    
    @action(detail=False, methods=['get'])
    def treatment_priorities(self, request):
        """Get prioritized list of risks for treatment"""
        priorities = RiskRecommendationService.get_risk_treatment_priorities(
            company=request.tenant
        )
        
        return Response(priorities)
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Get risks grouped by category"""
        from django.db.models import Count
        
        by_category = self.get_queryset().values('risk_category').annotate(
            count=Count('id'),
        ).order_by('-count')
        
        return Response(list(by_category))
    
    @action(detail=False, methods=['get'])
    def overdue_reviews(self, request):
        """Get risks with overdue reviews"""
        from django.utils import timezone
        
        overdue = self.get_queryset().filter(
            next_review_date__lt=timezone.now().date(),
            status__in=['identified', 'assessing', 'treating', 'monitoring']
        )
        
        serializer = RiskListSerializer(overdue, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def high_risk(self, request):
        """Get high and critical risks"""
        high_risks = self.get_queryset().filter(
            inherent_risk_level__in=['high', 'critical'],
            status__in=['identified', 'assessing', 'treating', 'monitoring']
        )
        
        serializer = RiskListSerializer(high_risks, many=True)
        return Response(serializer.data)


class RiskAssessmentViewSet(viewsets.ModelViewSet):
    """Risk assessment management"""
    
    serializer_class = RiskAssessmentSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = [
        'risk', 'applied_control', 'control_effectiveness',
        'residual_risk_level', 'is_current'
    ]
    ordering_fields = ['assessment_date', 'residual_score']
    ordering = ['-assessment_date']
    
    def get_queryset(self):
        """Get assessments for current company"""
        if hasattr(self.request, 'tenant'):
            return RiskAssessment.objects.for_company(
                self.request.tenant
            ).select_related(
                'risk', 'applied_control', 'applied_control__reference_control',
                'assessed_by'
            )
        return RiskAssessment.objects.none()
    
    def perform_create(self, serializer):
        """Set company and assessed_by"""
        serializer.save(
            company=self.request.tenant,
            assessed_by=self.request.user
        )
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current (active) assessments"""
        current = self.get_queryset().filter(is_current=True)
        serializer = self.get_serializer(current, many=True)
        return Response(serializer.data)


class RiskEventViewSet(viewsets.ModelViewSet):
    """Risk event (incident) management"""
    
    serializer_class = RiskEventSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['risk', 'is_resolved']
    ordering_fields = ['event_date', 'financial_impact']
    ordering = ['-event_date']
    
    def get_queryset(self):
        """Get events for current company"""
        if hasattr(self.request, 'tenant'):
            return RiskEvent.objects.for_company(
                self.request.tenant
            ).select_related('risk')
        return RiskEvent.objects.none()
    
    def perform_create(self, serializer):
        """Set company from request"""
        serializer.save(company=self.request.tenant)
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Mark event as resolved"""
        event = self.get_object()
        
        from django.utils import timezone
        event.is_resolved = True
        event.resolution_date = timezone.now().date()
        event.save()
        
        serializer = self.get_serializer(event)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def unresolved(self, request):
        """Get unresolved events"""
        unresolved = self.get_queryset().filter(is_resolved=False)
        serializer = self.get_serializer(unresolved, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_risk(self, request):
        """Get events grouped by risk"""
        from django.db.models import Count, Sum
        
        risk_id = request.query_params.get('risk')
        if not risk_id:
            return Response(
                {'error': 'risk parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        events = self.get_queryset().filter(risk_id=risk_id)
        
        stats = events.aggregate(
            total_events=Count('id'),
            total_financial_impact=Sum('financial_impact')
        )
        
        serializer = self.get_serializer(events, many=True)
        
        return Response({
            'events': serializer.data,
            'stats': stats
        })


class RiskTreatmentActionViewSet(viewsets.ModelViewSet):
    """Risk treatment action management"""
    
    serializer_class = RiskTreatmentActionSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['risk', 'action_type', 'status', 'action_owner']
    search_fields = ['action_title', 'action_description']
    ordering_fields = ['due_date', 'progress_percentage']
    ordering = ['due_date']
    
    def get_queryset(self):
        """Get actions for current company"""
        if hasattr(self.request, 'tenant'):
            return RiskTreatmentAction.objects.for_company(
                self.request.tenant
            ).select_related('risk', 'action_owner')
        return RiskTreatmentAction.objects.none()
    
    def perform_create(self, serializer):
        """Set company from request"""
        serializer.save(company=self.request.tenant)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark action as completed"""
        action = self.get_object()
        
        from django.utils import timezone
        action.status = 'completed'
        action.completion_date = timezone.now().date()
        action.progress_percentage = 100
        
        if 'actual_cost' in request.data:
            action.actual_cost = request.data['actual_cost']
        
        action.save()
        
        serializer = self.get_serializer(action)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        """Update action progress"""
        action = self.get_object()
        
        progress = request.data.get('progress_percentage')
        if progress is not None:
            action.progress_percentage = progress
        
        if 'progress_notes' in request.data:
            action.progress_notes = request.data['progress_notes']
        
        if 'status' in request.data:
            action.status = request.data['status']
        
        action.save()
        
        serializer = self.get_serializer(action)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue actions"""
        from django.utils import timezone
        
        overdue = self.get_queryset().filter(
            due_date__lt=timezone.now().date(),
            status__in=['planned', 'in_progress']
        )
        
        serializer = self.get_serializer(overdue, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def in_progress(self, request):
        """Get in-progress actions"""
        in_progress = self.get_queryset().filter(status='in_progress')
        serializer = self.get_serializer(in_progress, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_owner(self, request):
        """Get actions by owner"""
        owner_id = request.query_params.get('owner')
        
        if owner_id:
            actions = self.get_queryset().filter(action_owner_id=owner_id)
        else:
            # Get current user's actions
            actions = self.get_queryset().filter(action_owner=request.user)
        
        serializer = self.get_serializer(actions, many=True)
        return Response(serializer.data)