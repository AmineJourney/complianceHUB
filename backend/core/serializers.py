# core/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from .models import Company, Membership, Invitation

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True, required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'password_confirm', 'first_name', 'last_name']
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        return User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name']
        )


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name', 'plan', 'is_active', 'max_users', 'max_storage_mb', 'created_at']
        read_only_fields = ['id', 'created_at']


class MembershipSerializer(serializers.ModelSerializer):
    """Full membership serializer — includes user details for team management."""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)
    user_name = serializers.SerializerMethodField()
    company_name = serializers.CharField(source='company.name', read_only=True)

    class Meta:
        model = Membership
        fields = [
            'id', 'user', 'company', 'role', 'is_active', 'is_deleted',
            'user_email', 'user_first_name', 'user_last_name', 'user_name',
            'company_name', 'invitation_accepted_at', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'company', 'created_at', 'invitation_accepted_at']

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.email


class MembershipUpdateSerializer(serializers.ModelSerializer):
    """Only allows changing role — used by PATCH /memberships/{id}/"""
    class Meta:
        model = Membership
        fields = ['role']

    def validate_role(self, value):
        request = self.context.get('request')
        instance = self.instance

        # Prevent demoting the last owner
        if instance and instance.role == 'owner' and value != 'owner':
            owner_count = Membership.objects.filter(
                company=instance.company,
                role='owner',
                is_deleted=False
            ).count()
            if owner_count <= 1:
                raise serializers.ValidationError(
                    "Cannot change role: this is the last owner of the company."
                )

        # Prevent self-demotion from owner
        if request and instance and instance.user == request.user and value != 'owner':
            if instance.role == 'owner':
                raise serializers.ValidationError(
                    "Owners cannot demote themselves. Transfer ownership first."
                )

        return value


class InvitationSerializer(serializers.ModelSerializer):
    """Full invitation serializer for responses."""
    invited_by_email = serializers.EmailField(source='invited_by.email', read_only=True)
    invited_by_name = serializers.SerializerMethodField()
    company_name = serializers.CharField(source='company.name', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Invitation
        fields = [
            'id', 'company', 'company_name', 'invited_by', 'invited_by_email',
            'invited_by_name', 'email', 'role', 'token', 'expires_at',
            'accepted_at', 'accepted_by', 'is_revoked', 'is_expired', 'is_valid',
            'created_at'
        ]
        read_only_fields = [
            'id', 'company', 'invited_by', 'token', 'expires_at',
            'accepted_at', 'accepted_by', 'is_expired', 'is_valid', 'created_at'
        ]

    def get_invited_by_name(self, obj):
        return f"{obj.invited_by.first_name} {obj.invited_by.last_name}".strip() or obj.invited_by.email


class InvitationCreateSerializer(serializers.ModelSerializer):
    """Used for POST /invitations/ — only role and optional email needed."""
    class Meta:
        model = Invitation
        fields = ['role', 'email']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True},
        }

    def validate_role(self, value):
        # Only owner/admin can set role to owner/admin
        request = self.context.get('request')
        if request and hasattr(request, 'membership'):
            requester_role = request.membership.role
            if value in ('owner', 'admin') and requester_role not in ('owner', 'admin'):
                raise serializers.ValidationError(
                    "Only owners and admins can invite users with admin-level roles."
                )
        return value


class InvitationPublicSerializer(serializers.ModelSerializer):
    """
    Publicly accessible serializer — returned when a non-authenticated user
    visits /invitations/preview/?token=xxx.
    Only exposes safe fields (no internal IDs, no full user details).
    """
    company_name = serializers.CharField(source='company.name', read_only=True)
    invited_by_name = serializers.SerializerMethodField()
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Invitation
        fields = [
            'company_name', 'invited_by_name', 'role',
            'email', 'expires_at', 'is_valid'
        ]

    def get_invited_by_name(self, obj):
        return f"{obj.invited_by.first_name} {obj.invited_by.last_name}".strip() or obj.invited_by.email


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        memberships = Membership.objects.filter(
            user=user,
            is_deleted=False
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
        if len(companies) == 1:
            data['company_id'] = companies[0]['id']
        return data