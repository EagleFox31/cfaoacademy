from rest_framework.routers import SimpleRouter

from .views import CourseViewSet, EnrollmentViewSet, ModuleViewSet

router = SimpleRouter()
router.register(r"lms/courses", CourseViewSet, basename="course")
router.register(r"lms/modules", ModuleViewSet, basename="module")
router.register(r"lms/enrollments", EnrollmentViewSet, basename="enrollment")

urlpatterns = router.urls
