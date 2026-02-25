from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Q
from .models import StoredLibrary, LoadedLibrary, Framework, Requirement
from .serializers import (
    StoredLibrarySerializer, LoadedLibrarySerializer,
    FrameworkSerializer, FrameworkDetailSerializer,
    RequirementListSerializer, RequirementDetailSerializer,
    RequirementTreeSerializer,
)


class StoredLibraryViewSet(viewsets.ReadOnlyModelViewSet):
    """Stored library management (read-only)"""
    queryset = StoredLibrary.objects.all()
    serializer_class = StoredLibrarySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'version']
    ordering = ['-created_at']

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class LoadedLibraryViewSet(viewsets.ReadOnlyModelViewSet):
    """Loaded library management"""
    queryset = LoadedLibrary.objects.all()
    serializer_class = LoadedLibrarySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_active']
    ordering = ['-created_at']

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False).select_related('stored_library')

    @action(detail=True, methods=['get'])
    def frameworks(self, request, pk=None):
        """Get all frameworks in this library version"""
        loaded_library = self.get_object()
        frameworks = loaded_library.frameworks.filter(is_deleted=False)
        serializer = FrameworkSerializer(frameworks, many=True)
        return Response(serializer.data)


class FrameworkViewSet(viewsets.ModelViewSet):
    """
    Framework management
    Read-only for regular users, admin-only for modifications
    """
    queryset = Framework.objects.all()
    serializer_class = FrameworkSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['loaded_library', 'category', 'is_published']
    search_fields = ['name', 'code', 'description', 'issuing_organization']
    ordering_fields = ['name', 'code', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.request.user.is_staff:
            qs = qs.filter(is_published=True)
        qs = qs.filter(
            loaded_library__is_active=True,
            loaded_library__is_deleted=False,
            is_deleted=False
        )
        return qs.select_related('loaded_library', 'loaded_library__stored_library')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return FrameworkDetailSerializer
        return FrameworkSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'])
    def requirements(self, request, pk=None):
        """Get all requirements for this framework"""
        framework = self.get_object()
        requirements = framework.requirements.filter(is_deleted=False)

        if request.query_params.get('tree') == 'true':
            roots = requirements.filter(parent__isnull=True).order_by('sort_order', 'code')
            serializer = RequirementTreeSerializer(roots, many=True)
        else:
            serializer = RequirementListSerializer(requirements, many=True)

        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def requirements_tree(self, request, pk=None):
        """Get hierarchical requirements tree"""
        framework = self.get_object()
        tree = framework.get_requirement_tree()
        return Response(tree)

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """
        Return requirement statistics for this framework.

        Response shape matches the frontend FrameworkStatistics type:
        {
            total_requirements:    int,
            mandatory_requirements: int,
            optional_requirements:  int,
            by_priority:  { critical: N, high: N, medium: N, low: N },
            by_section:   [{ section: str, count: int }, ...]
        }

        "section" = the code of each root-level (top-level) requirement group.
        For ISO 27001 these are e.g. "A.5", "A.6", …
        For TISAX they would be the top-level clause codes.
        """
        framework = self.get_object()
        requirements = framework.requirements.filter(is_deleted=False)

        total = requirements.count()
        mandatory = requirements.filter(is_mandatory=True).count()

        # by_priority — count per priority label
        priority_qs = (
            requirements
            .values('priority')
            .annotate(count=Count('id'))
        )
        by_priority = {row['priority']: row['count'] for row in priority_qs}
        # Ensure all four keys are always present
        for p in ('critical', 'high', 'medium', 'low'):
            by_priority.setdefault(p, 0)

        # by_section — group by root ancestor code
        # Root requirements have parent=None; their code is the "section".
        # Child requirements belong to the same section as their root ancestor.
        # We do this in Python to avoid recursive SQL (works fine for typical
        # framework sizes of 50–300 requirements).
        root_reqs = list(
            requirements.filter(parent__isnull=True)
            .order_by('sort_order', 'code')
            .values('id', 'code')
        )

        # Build child→root map
        all_reqs = list(
            requirements
            .values('id', 'parent_id')
        )
        parent_map = {r['id']: r['parent_id'] for r in all_reqs}
        root_id_map = {r['id']: r['code'] for r in root_reqs}

        def get_root_code(req_id):
            visited = set()
            current = req_id
            while current is not None:
                if current in visited:
                    break
                visited.add(current)
                if current in root_id_map:
                    return root_id_map[current]
                current = parent_map.get(current)
            return None

        section_counts: dict = {}
        for r in all_reqs:
            code = get_root_code(r['id'])
            if code:
                section_counts[code] = section_counts.get(code, 0) + 1

        by_section = [
            {'section': code, 'count': count}
            for code, count in sorted(section_counts.items())
        ]

        return Response({
            'total_requirements': total,
            'mandatory_requirements': mandatory,
            'optional_requirements': total - mandatory,
            'by_priority': by_priority,
            'by_section': by_section,
        })

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all frameworks from active library versions"""
        frameworks = self.get_queryset()
        serializer = self.get_serializer(frameworks, many=True)
        return Response(serializer.data)


class RequirementViewSet(viewsets.ModelViewSet):
    """
    Requirement management
    Read-only for regular users, admin-only for modifications
    """
    queryset = Requirement.objects.all()
    serializer_class = RequirementListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        'framework', 'parent', 'requirement_type',
        'priority', 'is_mandatory'
    ]
    search_fields = ['code', 'title', 'description']
    ordering_fields = ['code', 'sort_order', 'priority']
    ordering = ['sort_order', 'code']

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(
            framework__loaded_library__is_active=True,
            framework__loaded_library__is_deleted=False,
            framework__is_deleted=False,
            is_deleted=False
        )
        return qs.select_related('framework', 'parent')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return RequirementDetailSerializer
        return RequirementListSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        requirement = self.get_object()
        children = requirement.children.filter(is_deleted=False).order_by('sort_order', 'code')
        serializer = self.get_serializer(children, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def ancestors(self, request, pk=None):
        requirement = self.get_object()
        ancestors = requirement.get_ancestors()
        serializer = self.get_serializer(ancestors, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def descendants(self, request, pk=None):
        requirement = self.get_object()
        descendants = requirement.get_descendants()
        serializer = self.get_serializer(descendants, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def control_mappings(self, request, pk=None):
        """Get all controls mapped to this requirement"""
        requirement = self.get_object()
        from controls.models import RequirementReferenceControl
        from controls.serializers import RequirementReferenceControlSerializer
        mappings = RequirementReferenceControl.objects.filter(
            requirement=requirement,
            is_deleted=False
        ).select_related('reference_control')
        serializer = RequirementReferenceControlSerializer(mappings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def roots(self, request):
        framework_id = request.query_params.get('framework')
        if not framework_id:
            return Response(
                {'error': 'framework parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        roots = self.get_queryset().filter(
            framework_id=framework_id,
            parent__isnull=True
        )
        serializer = self.get_serializer(roots, many=True)
        return Response(serializer.data)