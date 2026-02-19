from rest_framework import permissions, response, views
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.users.serializers_auth import LogoutSerializer
from apps.users.serializers import UserMeSerializer


class LoginView(TokenObtainPairView):
    throttle_scope = "auth_login"


class MeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserMeSerializer(request.user)
        return response.Response(serializer.data)


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # JWT logout is client-side token disposal unless blacklist support is enabled.
        return response.Response({"detail": "Logged out."})
