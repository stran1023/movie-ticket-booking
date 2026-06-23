from django.db import models
from django.utils import timezone


class NonDeletedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class BaseModel(models.Model):
    """
    Abstract base model for Traceability and Soft Delete.
    Inherit from this model instead of models.Model.
    """

    created_at = models.DateTimeField(
        default=timezone.now, editable=False, db_index=True
    )
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    objects = NonDeletedManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def soft_delete(self):
        self.is_deleted = True
        self.save(update_fields=["is_deleted", "updated_at"])
