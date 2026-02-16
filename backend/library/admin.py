from django.contrib import admin
from .models import StoredLibrary, LoadedLibrary, Framework, Requirement


@admin.register(StoredLibrary)
class StoredLibraryAdmin(admin.ModelAdmin):
    list_display = ['name', 'library_type', 'content_format', 'created_at']
    list_filter = ['library_type', 'content_format']
    search_fields = ['name', 'description', 'source_organization']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(LoadedLibrary)
class LoadedLibraryAdmin(admin.ModelAdmin):
    list_display = ['stored_library', 'version', 'is_active', 'processing_status', 'created_at']
    list_filter = ['is_active', 'processing_status']
    search_fields = ['stored_library__name', 'version']
    readonly_fields = ['created_at', 'updated_at']
    actions = ['activate_version']
    
    def activate_version(self, request, queryset):
        for loaded_lib in queryset:
            loaded_lib.activate()
        self.message_user(request, f'Activated {queryset.count()} version(s)')
    activate_version.short_description = 'Activate selected versions'


@admin.register(Framework)
class FrameworkAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'loaded_library', 'category', 'is_published', 'created_at']
    list_filter = ['category', 'is_published']
    search_fields = ['name', 'code', 'issuing_organization']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Requirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display = ['code', 'title', 'framework', 'requirement_type', 'priority', 'is_mandatory']
    list_filter = ['requirement_type', 'priority', 'is_mandatory']
    search_fields = ['code', 'title', 'description']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['framework', 'parent']
