from collections.abc import Mapping

from rest_framework import response


STATUS_CODE_DEFAULTS = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    415: "unsupported_media_type",
    429: "rate_limited",
    500: "server_error",
}


def error_code_for_status(status_code: int) -> str:
    return STATUS_CODE_DEFAULTS.get(status_code, "error")


def error_payload(
    *,
    message: str,
    status_code: int,
    code: str | None = None,
    details=None,
    request=None,
) -> dict:
    payload = {
        "error": {
            "code": code or error_code_for_status(status_code),
            "message": str(message),
        }
    }
    if details not in (None, {}, []):
        payload["error"]["details"] = details

    request_id = getattr(request, "request_id", None)
    if request_id:
        payload["error"]["request_id"] = request_id
        payload["request_id"] = request_id
    return payload


def api_error(
    *,
    message: str,
    status_code: int,
    code: str | None = None,
    details=None,
    request=None,
):
    return response.Response(
        error_payload(
            message=message,
            status_code=status_code,
            code=code,
            details=details,
            request=request,
        ),
        status=status_code,
    )


def looks_like_legacy_detail_error(data) -> bool:
    if not isinstance(data, Mapping):
        return False
    if "error" in data:
        return False
    return "detail" in data
