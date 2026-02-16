from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import Company, User, Membership


class CompanySerializer(serializers.ModelSerializer):
    """Company serializer"""
    
    member_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Company
        fields = [
            'id', 'name', 'plan', 'is_active', 'max_users', 'max_storage_mb',
            'member_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'member_count']
    
    def get_member_count(self, obj):
        return obj.memberships.filter(is_deleted=False).count()


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'avatar', 'is_active', 'email_verified',
            'last_login', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'last_login', 'email_verified']
        extra_kwargs = {
            'password': {'write_only': True}
        }


class UserRegistrationSerializer(serializers.ModelSerializer):
    """User registration with password validation"""
    
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'password_confirm', 'first_name', 'last_name']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match'
            })
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class MembershipSerializer(serializers.ModelSerializer):
    """Membership serializer"""
    
    user = UserSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    
    class Meta:
        model = Membership
        fields = [
            'id', 'user', 'user_id', 'company', 'company_name', 'role',
            'invited_by', 'invitation_accepted_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'invitation_accepted_at']
    
    def validate(self, attrs):
        """Validate membership creation"""
        request = self.context.get('request')
        
        # Ensure user is adding to their own company
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate user exists
        user_id = attrs.get('user_id')
        try:
            User.objects.get(id=user_id, is_deleted=False)
        except User.DoesNotExist:
            raise serializers.ValidationError({'user_id': 'User not found'})
        
        return attrs


class CompanyWithMembershipSerializer(CompanySerializer):
    """Company with current user's membership role"""
    
    current_user_role = serializers.SerializerMethodField()
    
    class Meta(CompanySerializer.Meta):
        fields = CompanySerializer.Meta.fields + ['current_user_role']
    
    def get_current_user_role(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'membership'):
            return request.membership.role
        return None