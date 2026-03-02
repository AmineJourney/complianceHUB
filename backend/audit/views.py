from rest_framework import serializers, viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, CharFilter, DateFilter
from django.http import StreamingHttpResponse
import csv
import io

from core.permissions import IsTenantMember
from .models import AuditLog


# ─── Serializer ────────────────────────────────────────────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'resource_type', 'object_id', 'object_repr',
            'actor', 'actor_email', 'ip_address',
            'changes', 'metadata',
            'timestamp',
        ]
        read_only_fields = fields

    def get_actor_email(self, obj):
        # Prefer the snapshot email (survives user deletion)
        return obj.actor_email or (obj.actor.email if obj.actor else None)


# ─── Filter ────────────────────────────────────────────────────────────────

class AuditLogFilter(FilterSet):
    action        = CharFilter(field_name='action', lookup_expr='exact')
    resource_type = CharFilter(field_name='resource_type', lookup_expr='iexact')
    actor_email   = CharFilter(field_name='actor_email', lookup_expr='icontains')
    object_id     = CharFilter(field_name='object_id', lookup_expr='exact')
    date_from     = DateFilter(field_name='timestamp', lookup_expr='date__gte')
    date_to       = DateFilter(field_name='timestamp', lookup_expr='date__lte')

    class Meta:
        model = AuditLog
        fields = ['action', 'resource_type', 'actor_email', 'object_id', 'date_from', 'date_to']


# ─── ViewSet ───────────────────────────────────────────────────────────────

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit log. Filterable by action, resource type, actor, date range.
    Supports CSV export for auditors.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsTenantMember]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = AuditLogFilter
    search_fields = ['object_repr', 'actor_email', 'action']
    ordering_fields = ['timestamp', 'action', 'resource_type']
    ordering = ['-timestamp']

    def get_queryset(self):
        if not hasattr(self.request, 'tenant'):
            return AuditLog.objects.none()
        return (
            AuditLog.objects
            .filter(company=self.request.tenant)
            .select_related('actor', 'content_type')
        )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Quick stats for the audit dashboard widget.
        Returns action counts for the last 30 days grouped by action type.
        """
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Count

        since = timezone.now() - timedelta(days=30)
        qs = self.get_queryset().filter(timestamp__gte=since)

        by_action = list(
            qs.values('action').annotate(count=Count('id')).order_by('-count')
        )
        by_actor = list(
            qs.values('actor_email').annotate(count=Count('id')).order_by('-count')[:10]
        )
        by_resource = list(
            qs.values('resource_type').annotate(count=Count('id')).order_by('-count')
        )

        return Response({
            'total_last_30_days': qs.count(),
            'by_action': by_action,
            'by_actor': by_actor,
            'by_resource': by_resource,
        })

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Stream a CSV export of the current filtered queryset.
        Auditors can download and hand to certification bodies.
        """
        qs = self.filter_queryset(self.get_queryset())

        def stream():
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                'Timestamp', 'Actor', 'IP Address',
                'Action', 'Resource Type', 'Object',
                'Changes', 'Metadata',
            ])
            yield buf.getvalue()
            buf.truncate(0)
            buf.seek(0)

            for log in qs.iterator(chunk_size=500):
                writer.writerow([
                    log.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC'),
                    log.actor_email,
                    log.ip_address or '',
                    log.get_action_display(),
                    log.resource_type,
                    log.object_repr,
                    str(log.changes) if log.changes else '',
                    str(log.metadata) if log.metadata else '',
                ])
                yield buf.getvalue()
                buf.truncate(0)
                buf.seek(0)

        response = StreamingHttpResponse(stream(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_log.csv"'
        return response
