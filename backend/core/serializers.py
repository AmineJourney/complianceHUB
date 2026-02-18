# core/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import Company, Membership

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """User serializer for responses"""
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """User registration serializer with password confirmation"""
    
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = [
            'email', 'username', 'password', 'password_confirm',
            'first_name', 'last_name'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }
    
    def validate_email(self, value):
        """Ensure email is unique"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def validate_username(self, value):
        """Ensure username is unique"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def validate(self, attrs):
        """Ensure passwords match"""
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })
        return attrs
    
    def create(self, validated_data):
        """Create user with hashed password"""
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name']
        )
        return user


class CompanySerializer(serializers.ModelSerializer):
    """Company serializer"""
    
    class Meta:
        model = Company
        fields = [
            'id', 'name', 'plan', 'is_active',
            'max_users', 'max_storage_mb', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class MembershipSerializer(serializers.ModelSerializer):
    """Membership serializer"""
    
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    company_name = serializers.CharField(source='company.name', read_only=True)
    
    class Meta:
        model = Membership
        fields = [
            'id', 'user', 'company', 'role', 'is_deleted',
            'user_email', 'user_name', 'company_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom token serializer that returns user companies
    """
    
    def validate(self, attrs):
        # Get default token data
        data = super().validate(attrs)
        
        # Add user companies to response
        user = self.user
        memberships = Membership.objects.filter(
            user=user,
            is_deleted=False
        ).select_related('company')
        
        companies = [
            {
                'id': str(membership.company.id),
                'name': membership.company.name,
                'role': membership.role
            }
            for membership in memberships
        ]
        
        data['companies'] = companies
        
        # If user has only one company, auto-select it
        if len(companies) == 1:
            data['company_id'] = companies[0]['id']
        
        return data

    def get_membership(self, request, company_id):
        membership = Membership.objects.select_related('company').get(
            user=request.user,
            company_id=company_id,
            is_deleted=False,
            company__is_active=True
        )
        return membership
