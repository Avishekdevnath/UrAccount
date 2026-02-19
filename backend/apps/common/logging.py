import contextvars
import logging


request_id_var = contextvars.ContextVar("request_id", default="-")


def set_request_id(request_id: str):
    return request_id_var.set(request_id)


def reset_request_id(token):
    request_id_var.reset(token)


class RequestIDLogFilter(logging.Filter):
    def filter(self, record):
        request_id = request_id_var.get("-")
        if request_id == "-" and hasattr(record, "request"):
            request_id = getattr(record.request, "request_id", "-")
        record.request_id = request_id
        return True
