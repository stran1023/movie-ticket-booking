from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from apps.users.models import UserProfile

User = get_user_model()


class ManageProfileAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("me")
        # 1. Create a test user
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        # 2. Create the associated profile
        self.profile = UserProfile.objects.create(
            user=self.user,
            full_name="Original Name",
            phone_number="0901234567",
            identity_card="123456789",
            gender="male",
            province="Hồ Chí Minh",
            ward="Phường 1",
            street_address="123 Old Street",
            date_of_birth="1990-01-01",
        )

    def test_unauthenticated_access_denied(self):
        """Test Case 6: Unauthenticated access is denied."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        response_patch = self.client.patch(self.url, {"full_name": "Hacker"})
        self.assertEqual(response_patch.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_profile_view_mode(self):
        """Test Case 1: Retrieve Profile (View Mode)."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")
        self.assertEqual(response.data["email"], "testuser@example.com")

        # Check nested profile fields (based on MeReadSerializer)
        profile_data = response.data["profile"]
        self.assertEqual(profile_data["full_name"], "Original Name")
        self.assertEqual(profile_data["phone_number"], "0901234567")

    def test_successful_profile_update(self):
        """Test Case 2: Successful Profile Update (Valid Data)."""
        self.client.force_authenticate(user=self.user)
        update_payload = {
            "full_name": "Updated Name",
            "phone_number": "0987654321",
            "gender": "female",
            "identity_card": "987654321",
        }
        response = self.client.patch(self.url, update_payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify database actually changed
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.full_name, "Updated Name")
        self.assertEqual(self.profile.phone_number, "0987654321")
        self.assertEqual(self.profile.gender, "female")

    def test_missing_required_fields_validation(self):
        """Test Case 3: Missing Required Fields Validation."""
        self.client.force_authenticate(user=self.user)
        update_payload = {
            "phone_number": "0911111111"
            # Missing full_name, gender, identity_card
        }

        # Use PUT to test full replacement which should trigger required field errors
        response = self.client.put(self.url, update_payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Assert the error keys exist
        self.assertIn("full_name", response.data)
        self.assertIn("gender", response.data)
        self.assertIn("identity_card", response.data)

    def test_invalid_data_format_rejection(self):
        """Test Case 4: Invalid Data Format Rejection."""
        self.client.force_authenticate(user=self.user)

        # 1. Test invalid email
        response_email = self.client.patch(self.url, {"email": "invalid-email-format"})
        self.assertEqual(response_email.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response_email.data)

        # 2. Test duplicate phone number (your serializer has a validate_phone_number method)
        # Create another user to steal their phone number
        other_user = User.objects.create_user(
            username="other", email="other@test.com", password="pwd"
        )
        UserProfile.objects.create(
            user=other_user,
            full_name="Other",
            phone_number="0999999999",
            identity_card="999",
            gender="male",
        )

        response_phone = self.client.patch(self.url, {"phone_number": "0999999999"})
        self.assertEqual(response_phone.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone_number", response_phone.data)

    def test_read_only_field_protection(self):
        """Test Case 5: Read-Only Field Protection."""
        self.client.force_authenticate(user=self.user)

        # MeWriteSerializer defines 'id', 'username', 'date_joined' as read_only_fields
        update_payload = {"username": "hacked_username", "id": 9999}

        response = self.client.patch(self.url, update_payload)

        # The request shouldn't fail, but it should IGNORE the read-only fields
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        # Verify the username and ID did NOT change
        self.assertEqual(self.user.username, "testuser")
        self.assertNotEqual(self.user.id, 9999)
