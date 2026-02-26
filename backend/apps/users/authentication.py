from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class PasswordVersionJWTAuthentication(JWTAuthentication):
    """Reject tokens issued before the latest password change."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        token_pwd_ts = validated_token.get("pwd_ts")
        if token_pwd_ts is None:
            raise AuthenticationFailed("Token missing password version.", code="token_not_valid")

        user_pwd_ts = int(user.password_changed_at.timestamp()) if user.password_changed_at else 0
        if int(token_pwd_ts) < user_pwd_ts:
            raise AuthenticationFailed("Token expired due to password change.", code="token_not_valid")
        return user
