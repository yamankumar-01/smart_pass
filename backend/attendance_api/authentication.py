from rest_framework_simplejwt.authentication import JWTAuthentication

class URLParamJWTAuthentication(JWTAuthentication):
    """
    Extends JWTAuthentication to also allow JWT access tokens passed via
    query parameter '?token=...' or '?auth=...' (useful for browser file downloads like Excel/CSV exports).
    """
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            raw_token = request.query_params.get('token') or request.query_params.get('auth')
            if raw_token is not None:
                raw_token = raw_token.encode('utf-8')

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
