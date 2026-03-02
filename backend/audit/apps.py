from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'audit'
    verbose_name = 'Audit Log'

    def ready(self):
        # Import services to register all signal handlers
        import audit.services  # noqa: F401
