from django.urls import path

from .views import contact_message

urlpatterns = [
    path("contact/", contact_message, name="contact_message"),
]
