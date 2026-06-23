from apps.core.models import BaseModel
from django.db import models


class ContactMessage(BaseModel):
    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message from {self.email} - {self.created_at}"

    class Meta:
        db_table = "Contact"
        ordering = ["-created_at"]
