from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User

class CaseInsensitiveModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if not username or not password:
            return None
        
        clean_username = username.strip()
        user = User.objects.filter(username__iexact=clean_username).first()
        if user and user.check_password(password.strip()):
            return user
        return None
