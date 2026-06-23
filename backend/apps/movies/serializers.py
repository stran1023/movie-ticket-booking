from rest_framework import serializers
from django.conf import settings
from .models import Movie


class MovieSerializer(serializers.ModelSerializer):
    _type = serializers.CharField(source="status", read_only=True)
    director = serializers.CharField(source="directors", read_only=True)
    genres = serializers.SerializerMethodField()
    version = serializers.StringRelatedField(
        many=True, source="versions", read_only=True
    )
    runtime = serializers.SerializerMethodField()
    rating = serializers.CharField(source="label", read_only=True)
    poster_url = serializers.SerializerMethodField()

    class Meta:
        model = Movie
        fields = [
            "id",
            "title",
            "director",
            "genres",
            "_type",
            "poster_url",
            "description",
            "runtime",
            "version",
            "rating",
            "trailer_url",
            "casts",
            "languages_subtitles",
        ]

    def get_genres(self, obj):
        if obj.genres:
            return [genre.strip() for genre in obj.genres.split(",")]
        return []

    def get_poster_url(self, obj):
        if obj.poster_file:
            filename = obj.poster_file
            if not filename.endswith(".jpg") and not filename.endswith(".png"):
                filename = f"{filename}.jpg"
            path = f"{settings.STATIC_URL}posters/{filename}"
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(path)

            return path
        return None

    def get_runtime(self, obj):
        if not obj.duration:
            return None
        hours = obj.duration // 60
        minutes = obj.duration % 60

        if hours > 0 and minutes > 0:
            return f"{hours} hr {minutes} min"
        elif hours > 0:
            return f"{hours} hr"
        else:
            return f"{minutes} min"
