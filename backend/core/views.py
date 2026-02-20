# core/views.py
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

from .models import Company, Membership, Invitation
from .serializers import (
    UserSerializer, UserRegistrationSerializer,
    CompanySerializer, MembershipSerializer, MembershipUpdateSerializer,
    InvitationSerializer, InvitationCreateSerializer, InvitationPublicSerializer,
    CustomTokenObtainPairSerializer
)
from .permissions import IsTenantMember, IsOwnerOrAdmin

User = get_user_model()


# ─── AUTH ────────────────────────────────────────────────────────────────────

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """POST /api/auth/register/"""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response(
            {'message': 'User registered successfully', 'user': UserSerializer(user).data},
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    GET  /api/auth/me/  → returns current user
    PATCH /api/auth/me/ → updates first_name, last_name, email
    """
    if request.method == 'GET':
        return Response(UserSerializer(request.user).data)

    # PATCH
    user = request.user
    allowed = ('first_name', 'last_name', 'email')
    for field in allowed:
        if field in request.data:
            if field == 'email':
                new_email = request.data['email']
                if User.objects.exclude(id=user.id).filter(email=new_email).exists():
                    return Response({'error': 'Email already in use'}, status=status.HTTP_400_BAD_REQUEST)
            setattr(user, field, request.data[field])
    user.save()
    return Response(UserSerializer(user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """POST /api/auth/change-password/"""
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    new_password_confirm = request.data.get('new_password_confirm')

    if not old_password or not new_password or not new_password_confirm:
        return Response({'error': 'All password fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not user.check_password(old_password):
        return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != new_password_confirm:
        return Response({'error': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user)
    except DjangoValidationError as e:
        return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    return Response({'message': 'Password changed successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """POST /api/auth/logout/"""
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            RefreshToken(refresh_token).blacklist()
        return Response({'message': 'Logged out successfully.'})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── COMPANY ─────────────────────────────────────────────────────────────────

class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Company.objects.filter(
            memberships__user=self.request.user,
            memberships__is_deleted=False
        ).distinct()

    def create(self, request, *args, **kwargs):
        return Response(
            {'error': 'Use POST /companies/create_with_membership/ instead'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    @action(detail=False, methods=['post'])
    def create_with_membership(self, request):
        """POST /api/companies/create_with_membership/"""
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Company name is required'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            company = Company.objects.create(
                name=name, plan='free', max_users=5, max_storage_mb=1024, is_active=True
            )
            membership = Membership.objects.create(
                user=request.user, company=company, role='owner',
                is_active=True, is_deleted=False
            )

        return Response(
            {'company': CompanySerializer(company).data, 'membership': MembershipSerializer(membership).data},
            status=status.HTTP_201_CREATED
        )


# ─── MEMBERSHIP ──────────────────────────────────────────────────────────────

class MembershipViewSet(viewsets.ModelViewSet):
    """
    Full CRUD membership management.
    - GET  /memberships/                     → own memberships (across all companies)
    - GET  /memberships/?company=<id>        → own membership for a company
    - GET  /memberships/company_members/     → all members of the current tenant (requires X-Company-ID)
    - PATCH /memberships/<id>/               → change a member's role (owner/admin only)
    - DELETE /memberships/<id>/              → remove a member (owner/admin only)
    """
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Default: return caller's own memberships
        queryset = Membership.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).select_related('user', 'company')

        company_id = self.request.query_params.get('company')
        if company_id:
            queryset = queryset.filter(company_id=company_id)

        return queryset

    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return MembershipUpdateSerializer
        return MembershipSerializer

    @action(detail=False, methods=['get'], url_path='company_members')
    def company_members(self, request):
        """
        GET /api/memberships/company_members/
        Returns all active members of the current tenant.
        Requires X-Company-ID header.
        """
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response({'error': 'Company context required.'}, status=status.HTTP_400_BAD_REQUEST)

        members = Membership.objects.filter(
            company=request.tenant,
            is_deleted=False
        ).select_related('user').order_by('user__first_name', 'user__last_name')

        serializer = MembershipSerializer(members, many=True)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """PATCH /api/memberships/<id>/ — change role"""
        instance = self.get_object()

        # Only owner/admin of the same company can change roles
        if not hasattr(request, 'tenant') or request.tenant != instance.company:
            return Response({'error': 'You can only manage members of your current company.'}, status=status.HTTP_403_FORBIDDEN)

        if not hasattr(request, 'membership') or request.membership.role not in ('owner', 'admin'):
            return Response({'error': 'Only owners and admins can change member roles.'}, status=status.HTTP_403_FORBIDDEN)

        # Admins cannot promote to owner
        new_role = request.data.get('role')
        if new_role == 'owner' and request.membership.role != 'owner':
            return Response({'error': 'Only owners can grant the owner role.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = MembershipUpdateSerializer(instance, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(MembershipSerializer(instance).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        """DELETE /api/memberships/<id>/ — remove a member"""
        instance = self.get_object()

        if not hasattr(request, 'tenant') or request.tenant != instance.company:
            return Response({'error': 'You can only manage members of your current company.'}, status=status.HTTP_403_FORBIDDEN)

        if not hasattr(request, 'membership') or request.membership.role not in ('owner', 'admin'):
            return Response({'error': 'Only owners and admins can remove members.'}, status=status.HTTP_403_FORBIDDEN)

        # Cannot remove yourself
        if instance.user == request.user:
            return Response({'error': 'You cannot remove yourself. Transfer ownership first.'}, status=status.HTTP_400_BAD_REQUEST)

        # Cannot remove the last owner
        if instance.role == 'owner':
            owner_count = Membership.objects.filter(
                company=instance.company, role='owner', is_deleted=False
            ).count()
            if owner_count <= 1:
                return Response({'error': 'Cannot remove the last owner of a company.'}, status=status.HTTP_400_BAD_REQUEST)

        instance.delete()  # soft delete
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── INVITATIONS ─────────────────────────────────────────────────────────────

class InvitationViewSet(viewsets.ModelViewSet):
    """
    Invitation management — no email required.
    The admin creates an invite, gets back a token, and shares the URL manually.

    - POST   /invitations/                → create invite (owner/admin only)
    - GET    /invitations/                → list pending invites for current company
    - DELETE /invitations/<id>/           → revoke invite
    - POST   /invitations/<id>/revoke/    → explicit revoke action
    - GET    /invitations/preview/?token= → PUBLIC — get invite info (no auth needed)
    - POST   /invitations/accept/         → accept invite (authenticated user)
    """
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not hasattr(self.request, 'tenant') or not self.request.tenant:
            return Invitation.objects.none()
        return Invitation.objects.filter(
            company=self.request.tenant
        ).select_related('invited_by', 'accepted_by', 'company').order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return InvitationCreateSerializer
        return InvitationSerializer

    def create(self, request, *args, **kwargs):
        """POST /api/invitations/ — create a shareable invite link"""
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response({'error': 'Company context required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not hasattr(request, 'membership') or request.membership.role not in ('owner', 'admin'):
            return Response({'error': 'Only owners and admins can create invitations.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = InvitationCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        invitation = serializer.save(
            company=request.tenant,
            invited_by=request.user
        )

        return Response(
            InvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED
        )

    def destroy(self, request, *args, **kwargs):
        """DELETE /api/invitations/<id>/ — revoke"""
        invitation = self.get_object()

        if request.membership.role not in ('owner', 'admin'):
            return Response({'error': 'Only owners and admins can revoke invitations.'}, status=status.HTTP_403_FORBIDDEN)

        invitation.is_revoked = True
        invitation.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """POST /api/invitations/<id>/revoke/"""
        invitation = self.get_object()
        if request.membership.role not in ('owner', 'admin'):
            return Response({'error': 'Only owners and admins can revoke invitations.'}, status=status.HTTP_403_FORBIDDEN)
        invitation.is_revoked = True
        invitation.save()
        return Response({'message': 'Invitation revoked.'})

    @action(detail=False, methods=['get'], permission_classes=[AllowAny], url_path='preview')
    def preview(self, request):
        """
        GET /api/invitations/preview/?token=<token>
        Public endpoint — returns invite details so the accept page can display them.
        """
        token = request.query_params.get('token')
        if not token:
            return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invitation = Invitation.objects.select_related('company', 'invited_by').get(token=token)
        except Invitation.DoesNotExist:
            return Response({'error': 'Invalid invitation token.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InvitationPublicSerializer(invitation)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def accept(self, request):
        """
        POST /api/invitations/accept/
        Body: { "token": "<token>" }
        The authenticated user accepts the invitation.
        """
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invitation = Invitation.objects.select_related('company', 'invited_by').get(token=token)
        except Invitation.DoesNotExist:
            return Response({'error': 'Invalid invitation token.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            membership = invitation.accept(request.user)
        except DjangoValidationError as e:
            return Response({'error': str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f'You have joined {invitation.company.name} as {invitation.role}.',
            'company': CompanySerializer(invitation.company).data,
            'membership': MembershipSerializer(membership).data,
        })