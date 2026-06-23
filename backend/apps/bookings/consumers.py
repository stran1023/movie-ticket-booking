import json

from channels.generic.websocket import AsyncWebsocketConsumer


class SeatHoldConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.showtime_id = self.scope["url_route"]["kwargs"]["showtime_id"]
        self.room_group_name = f"showtime_{self.showtime_id}"

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # Receive message from room group
    async def seat_update(self, event):
        action = event["action"]
        seats = event["seats"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps({"action": action, "seats": seats}))
