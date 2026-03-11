"""Custom application exceptions."""


class ServiceUnavailableError(Exception):
    """Raised when a required backend service (e.g. MongoDB) is not available."""

    def __init__(self, service: str = "database") -> None:
        self.service = service
        super().__init__(f"Service unavailable: {service} is not connected.")
