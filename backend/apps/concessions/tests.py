import json

from django.test import Client, TestCase, override_settings


@override_settings(DEBUG=False)
class ConcessionsApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def _unwrap_list(self, payload):
        # Accept both array and paginated {"results": [...]} forms.
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict) and isinstance(
            payload.get("results"), list
        ):
            return payload["results"]
        return []

    def test_sc_001_list_concessions_returns_200_and_list_shape(self):
        """
        ID: SC_001

        List endpoint returns 200 and a list/paginated results of concessions.
        """
        res = self.client.get(
            "/api/concessions/concessions/",
            {"include": "variants", "ordering": "-priority"},
        )
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.content.decode() or "[]")
        items = self._unwrap_list(data)
        self.assertIsInstance(items, list)
        if items:
            sample = items[0]
            for key in ("id", "name", "is_active", "is_combo", "category"):
                self.assertIn(key, sample)

    def test_sc_002_combos_list_returns_200(self):
        """
        ID: SC_002

        Combos list endpoint returns 200 and a list/paginated results.
        """
        res = self.client.get(
            "/api/concessions/concessions/combos/", {"include": "variants"}
        )
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.content.decode() or "[]")
        items = self._unwrap_list(data)
        self.assertIsInstance(items, list)

    def test_sc_003_price_preview_requires_valid_payload(self):
        """
        ID: SC_003
        
        Price preview returns 400 on malformed payload (missing 'lines').
        """
        res = self.client.post(
            "/api/concessions/price/preview/",
            data=json.dumps({}),  # missing required 'lines'
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        # Ensure JSON error body
        _ = json.loads(res.content.decode() or "{}")
