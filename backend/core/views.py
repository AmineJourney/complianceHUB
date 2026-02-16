from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.db.models import Q
from .models import Company, User, Membership
from .serializers import (
    CompanySerializer, UserSerializer, MembershipSerializer,
    UserRegistrationSerializer, CompanyWithMembershipSerializer
)
from .permissions import IsTenantMember, RolePermission


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token with company_id claim"""
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Get user's companies
        memberships = Membership.objects.filter(
            user=self.user,
            is_deleted=False,
            company__is_active=True
        ).select_related('company')
        
        companies = [
            {
                'id': str(m.company.id),
                'name': m.company.name,
                'role': m.role
            }
            for m in memberships
        ]
        
        data['companies'] = companies
        
        # If user has only one company, add it to token
        if len(companies) == 1:
            data['company_id'] = companies[0]['id']
        
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class CompanyViewSet(viewsets.ModelViewSet):
    """Company CRUD operations"""
    
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['plan', 'is_active']
    search_fields = ['name']
    
    def get_queryset(self):
        """Filter companies user has access to"""
        user = self.request.user
        return Company.objects.filter(
            memberships__user=user,
            memberships__is_deleted=False
        ).distinct()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CompanyWithMembershipSerializer
        return CompanySerializer
    
    @action(detail=False, methods=['post'])
    def create_with_membership(self, request):
        """Create company and add creator as owner"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = serializer.save()
        
        # Create owner membership
        Membership.objects.create(
            user=request.user,
            company=company,
            role='owner'
        )
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UserViewSet(viewsets.ModelViewSet):
    """User CRUD operations"""
    
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsTenantMember]
    search_fields = ['email', 'username', 'first_name', 'last_name']
    
    def get_queryset(self):
        """Filter users in same company"""
        if hasattr(self.request, 'tenant'):
            return User.objects.filter(
                memberships__company=self.request.tenant,
                memberships__is_deleted=False
            ).distinct()
        return User.objects.none()
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def register(self, request):
        """User registration"""
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'id': user.id,
            'email': user.email,
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)


class MembershipViewSet(viewsets.ModelViewSet):
    """Membership management"""
    
    queryset = Membership.objects.all()
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, RolePermission]
    filterset_fields = ['role']
    
    def get_queryset(self):
        """Filter memberships for current company"""
        if hasattr(self.request, 'tenant'):
            return Membership.objects.filter(
                company=self.request.tenant
            ).select_related('user', 'company')
        return Membership.objects.none()
    
    def perform_create(self, serializer):
        """Set invited_by to current user"""
        serializer.save(
            invited_by=self.request.user,
            company=self.request.tenant
        )