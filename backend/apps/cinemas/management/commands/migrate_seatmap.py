from django.core.management.base import BaseCommand
from apps.cinemas.models import CinemaRoom


class Command(BaseCommand):
    help = "Convert old seat_map format to new seat designer format"

    def convert_old_map(self, old_map):

        new_map = []

        for seat in old_map:

            row_letter = seat.get("row")
            number = seat.get("number")
            seat_type = seat.get("type", "normal")

            if not row_letter or not number:
                continue

            y = ord(row_letter.upper()) - 64

            new_map.append({
                "x": number,
                "y": y,
                "kind": "seat",
                "type": seat_type,
                "row": row_letter,
                "number": number,
            })

        return new_map


    def handle(self, *args, **options):

        rooms = CinemaRoom.objects.all()

        converted = 0

        for room in rooms:

            if not room.seat_map:
                continue

            # detect old format
            first = room.seat_map[0]

            if "x" in first and "y" in first:
                self.stdout.write(f"Room {room.id} already new format")
                continue

            new_map = self.convert_old_map(room.seat_map)

            room.seat_map = new_map
            room.total_seats = len(new_map)
            room.save()

            converted += 1

            self.stdout.write(
                self.style.SUCCESS(f"Converted room {room.id}")
            )

        self.stdout.write(
            self.style.SUCCESS(f"Migration finished. {converted} rooms converted.")
        )
