from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class PasswordVersionTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["pwd_ts"] = int(user.password_changed_at.timestamp()) if user.password_changed_at else 0
        return token
