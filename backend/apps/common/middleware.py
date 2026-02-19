import uuid
import logging

from django.http import JsonResponse
from apps.common.logging import reset_request_id, set_request_id
from apps.common.errors import error_payload, looks_like_legacy_detail_error

logger = logging.getLogger(__name__)


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.request_id = request_id
        context_token = set_request_id(request_id)
        try:
            response = self.get_response(request)
        finally:
            reset_request_id(context_token)
        response["X-Request-ID"] = request_id
        return response


class ErrorEnvelopeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception:
            logger.exception("Unhandled API exception")
            return JsonResponse(
                error_payload(
                    message="Internal server error.",
                    status_code=500,
                    request=request,
                ),
                status=500,
            )

        if response.status_code < 400:
            return response

        data = getattr(response, "data", None)
        if not looks_like_legacy_detail_error(data):
            return response

        response.data = error_payload(
            message=str(data["detail"]),
            status_code=response.status_code,
            request=request,
        )
        return response
