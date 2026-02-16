from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import StoredLibrary, LoadedLibrary, Framework, Requirement
from .serializers import (
    StoredLibrarySerializer, StoredLibraryDetailSerializer,
    LoadedLibrarySerializer, FrameworkSerializer, FrameworkDetailSerializer,
    RequirementListSerializer, RequirementDetailSerializer, RequirementTreeSerializer
)


class StoredLibraryViewSet(viewsets.ModelViewSet):
    """
    Stored library management
    Admin-only for create/update/delete
    """
    queryset = StoredLibrary.objects.all()
    serializer_class = StoredLibrarySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['library_type', 'content_format']
    search_fields = ['name', 'description', 'source_organization']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return StoredLibraryDetailSerializer
        return StoredLibrarySerializer
    
    def get_permissions(self):
        """Only admins can modify libraries"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions of a library"""
        library = self.get_object()
        versions = library.get_all_versions()
        serializer = LoadedLibrarySerializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def load_version(self, request, pk=None):
        """Load a new version of the library"""
        library = self.get_object()
        
        version = request.data.get('version')
        if not version:
            return Response(
                {'error': 'version is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new loaded version
        loaded = LoadedLibrary.objects.create(
            stored_library=library,
            version=version,
            release_date=request.data.get('release_date'),
            changelog=request.data.get('changelog', ''),
            processing_status='pending'
        )
        
        serializer = LoadedLibrarySerializer(loaded)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LoadedLibraryViewSet(viewsets.ModelViewSet):
    """
    Loaded library version management
    """
    queryset = LoadedLibrary.objects.all()
    serializer_class = LoadedLibrarySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['stored_library', 'is_active', 'processing_status']
    ordering_fields = ['version', 'release_date', 'created_at']
    ordering = ['-version']
    
    def get_permissions(self):
        """Only admins can modify loaded libraries"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def activate(self, request, pk=None):
        """Activate this library version"""
        loaded_library = self.get_object()
        
        try:
            loaded_library.activate()
            return Response({
                'message': f'Version {loaded_library.version} activated successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
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
        """Filter to show only published frameworks for non-admin users"""
        qs = super().get_queryset()
        
        # Admins see all, others only published
        if not self.request.user.is_staff:
            qs = qs.filter(is_published=True)
        
        # Only show frameworks from active libraries
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
        """Only admins can modify frameworks"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=True, methods=['get'])
    def requirements(self, request, pk=None):
        """Get all requirements for this framework"""
        framework = self.get_object()
        requirements = framework.requirements.filter(is_deleted=False)
        
        # Support tree view
        if request.query_params.get('tree') == 'true':
            # Get root requirements
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
        """Filter requirements from active libraries"""
        qs = super().get_queryset()
        
        # Only show requirements from active library versions
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
        """Only admins can modify requirements"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """Get all child requirements"""
        requirement = self.get_object()
        children = requirement.children.filter(is_deleted=False).order_by('sort_order', 'code')
        serializer = self.get_serializer(children, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def ancestors(self, request, pk=None):
        """Get all ancestor requirements"""
        requirement = self.get_object()
        ancestors = requirement.get_ancestors()
        serializer = self.get_serializer(ancestors, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def descendants(self, request, pk=None):
        """Get all descendant requirements"""
        requirement = self.get_object()
        descendants = requirement.get_descendants()
        serializer = self.get_serializer(descendants, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def roots(self, request):
        """Get all root requirements (no parent)"""
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