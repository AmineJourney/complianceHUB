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
from django.core.mail import send_mail
from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone

from .models import Company, Membership, Invitation, PasswordResetToken
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
@permission_classes([AllowAny])
def logout(request):
    """POST /api/auth/logout/"""
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            RefreshToken(refresh_token).blacklist()
        return Response({'message': 'Logged out successfully.'})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """
    POST /api/auth/password-reset/
    Body: { "email": "user@example.com" }

    Always returns 200 regardless of whether the email exists (prevents enumeration).

    Without SMTP (DEBUG=True):  the reset link is returned directly in the
                                response as `reset_link` so you can use it
                                immediately without any email setup.
    With SMTP (DEBUG=False):    the link is sent by email and NOT included
                                in the response.
    """
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Always return the same message to prevent user enumeration
    generic_response = Response({
        'message': 'If an account with that email exists, a reset link has been sent.'
    })

    try:
        user = User.objects.get(email=email, is_deleted=False)
    except User.DoesNotExist:
        return generic_response

    # Invalidate any existing unused tokens for this user
    PasswordResetToken.objects.filter(
        user=user,
        used_at__isnull=True
    ).update(expires_at=timezone.now())

    # Create a new token
    ip = (
        request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
        or request.META.get('REMOTE_ADDR')
    )
    reset_token = PasswordResetToken.objects.create(user=user, ip_address=ip or None)

    # Build the reset link (frontend URL)
    frontend_base = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
    reset_link = f"{frontend_base}/reset-password?token={reset_token.token}"

    if django_settings.DEBUG:
        # No SMTP configured — return the link directly so dev can test immediately.
        # This branch is never reached in production (DEBUG=False).
        return Response({
            'message': 'Reset link generated. Copy it below (dev mode — no email sent).',
            'reset_link': reset_link,
            'expires_in_minutes': 60,
        })

    # Production path — send email
    try:
        send_mail(
            subject='Password Reset Request',
            message=(
                f"Hi {user.first_name or user.email},\n\n"
                f"You requested a password reset. Click the link below to set a new password:\n\n"
                f"{reset_link}\n\n"
                f"This link expires in 1 hour.\n\n"
                f"If you did not request this, you can safely ignore this email."
            ),
            from_email=getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@compliancehub.com'),
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception:
        # Log but don't reveal the failure to the caller
        import logging
        logging.getLogger(__name__).exception('Failed to send password reset email to %s', email)

    return generic_response


@api_view(['POST'])
@permission_classes([AllowAny])
def confirm_password_reset(request):
    """
    POST /api/auth/password-reset/confirm/
    Body: { "token": "...", "new_password": "...", "new_password_confirm": "..." }
    """
    token_str = request.data.get('token', '').strip()
    new_password = request.data.get('new_password', '')
    new_password_confirm = request.data.get('new_password_confirm', '')

    if not token_str:
        return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not new_password or not new_password_confirm:
        return Response({'error': 'Both password fields are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_password != new_password_confirm:
        return Response({'error': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        reset_token = PasswordResetToken.objects.select_related('user').get(token=token_str)
    except PasswordResetToken.DoesNotExist:
        return Response({'error': 'Invalid or expired reset token.'}, status=status.HTTP_400_BAD_REQUEST)

    if not reset_token.is_valid:
        return Response({'error': 'This reset link has expired or already been used.'}, status=status.HTTP_400_BAD_REQUEST)

    user = reset_token.user

    try:
        validate_password(new_password, user)
    except DjangoValidationError as e:
        return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=['password'])
        reset_token.use()

    return Response({'message': 'Password has been reset successfully. You can now log in.'})


@api_view(['GET'])
@permission_classes([AllowAny])
def validate_reset_token(request):
    """
    GET /api/auth/password-reset/validate/?token=<token>
    Returns whether a token is still valid — used by the frontend reset page
    to show an error before the user even fills the form.
    """
    token_str = request.query_params.get('token', '').strip()
    if not token_str:
        return Response({'valid': False, 'error': 'Token is required.'})

    try:
        reset_token = PasswordResetToken.objects.get(token=token_str)
        return Response({'valid': reset_token.is_valid})
    except PasswordResetToken.DoesNotExist:
        return Response({'valid': False})


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