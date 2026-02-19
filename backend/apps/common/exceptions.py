import logging

from rest_framework import response, status
from rest_framework.views import exception_handler as drf_exception_handler

from apps.common.errors import error_payload

logger = logging.getLogger(__name__)


def _message_and_details_from_response_data(data):
    if isinstance(data, dict):
        if "error" in data:
            return None, None
        if "detail" in data:
            return str(data["detail"]), None
        return "Validation failed.", data

    if isinstance(data, list):
        return "Validation failed.", data

    if data is None:
        return "Request failed.", None

    return str(data), None


def standardized_exception_handler(exc, context):
    drf_response = drf_exception_handler(exc, context)
    if drf_response is None:
        request = context.get("request")
        logger.exception("Unhandled DRF exception", exc_info=exc)
        return response.Response(
            error_payload(
                message="Internal server error.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                request=request,
            ),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    message, details = _message_and_details_from_response_data(drf_response.data)
    if message is None:
        return drf_response

    request = context.get("request")
    drf_response.data = error_payload(
        message=message,
        status_code=drf_response.status_code,
        details=details,
        request=request,
    )
    return drf_response
