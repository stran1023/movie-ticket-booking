from rest_framework.routers import DefaultRouter

from .views import CinemaRoomViewSet, ShowtimeViewSet

router = DefaultRouter()
router.register("cinemas/rooms", CinemaRoomViewSet, basename="cinemaroom")
router.register("cinemas/showtimes", ShowtimeViewSet, basename="showtime")

urlpatterns = router.urls
