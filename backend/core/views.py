# core/views.py
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Company, Membership
from .serializers import (
    UserSerializer, UserRegistrationSerializer,
    CompanySerializer, MembershipSerializer,
    CustomTokenObtainPairSerializer
)

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom JWT token obtain view that returns user companies
    POST /api/auth/token/
    Body: { "email": "user@example.com", "password": "password" }
    Returns: { "access": "...", "refresh": "...", "companies": [...] }
    """
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    User registration endpoint
    POST /api/auth/register/
    Body: {
        "email": "user@example.com",
        "username": "username",
        "password": "password",
        "password_confirm": "password",
        "first_name": "John",
        "last_name": "Doe"
    }
    """
    serializer = UserRegistrationSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.save()
        return Response(
            {
                'message': 'User registered successfully',
                'user': UserSerializer(user).data
            },
            status=status.HTTP_201_CREATED
        )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    Get current authenticated user
    GET /api/auth/me/
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    Logout user by blacklisting refresh token
    POST /api/auth/logout/
    Body: { "refresh": "refresh_token" }
    """
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        
        return Response(
            {'message': 'Logged out successfully'},
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


class CompanyViewSet(viewsets.ModelViewSet):
    """
    Company management endpoints
    """
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get companies the user is a member of"""
        return Company.objects.filter(
            memberships__user=self.request.user,
            memberships__is_deleted=False
        ).distinct()
    
    def create(self, request, *args, **kwargs):
        """Not allowed - use create_with_membership instead"""
        return Response(
            {'error': 'Use POST /companies/create_with_membership/ instead'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )
    
    @action(detail=False, methods=['post'])
    def create_with_membership(self, request):
        """
        Create a new company and make the user an owner
        POST /api/companies/create_with_membership/
        Body: { "name": "Company Name" }
        """
        name = request.data.get('name')
        if not name:
            return Response(
                {'error': 'Company name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Create company
            company = Company.objects.create(
                name=name,
                plan='free',  # Default to free plan
                max_users=5,
                max_storage_mb=1024
            )
            
            # Create owner membership
            membership = Membership.objects.create(
                user=request.user,
                company=company,
                role='owner',
                is_deleted=False
            )
        
        return Response(
            {
                'company': CompanySerializer(company).data,
                'membership': MembershipSerializer(membership).data
            },
            status=status.HTTP_201_CREATED
        )


class MembershipViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Membership management endpoints (read-only for now)
    """
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Get memberships
        Can filter by company: ?company=<company_id>
        """
        queryset = Membership.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).select_related('user', 'company')
        
        # Filter by company if provided
        company_id = self.request.query_params.get('company')
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        
        return queryset
