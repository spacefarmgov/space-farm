"""Domain exceptions for data providers (never tied to FastAPI HTTPException)."""


class DataProviderError(Exception):
    """Base error raised by Space Farm data adapters."""


class InvalidDataQuery(DataProviderError):
    """Raised when query parameters or time standard violate upstream/provider rules."""

    def __init__(self, message: str, *, field: str = "query", reason: str = "invalid_query") -> None:
        super().__init__(message)
        self.field = field
        self.reason = reason


class DataUnavailable(DataProviderError):
    """Raised when upstream data cannot be retrieved and no exact matching cache exists."""

    def __init__(
        self,
        message: str,
        *,
        retryable: bool = True,
        reason: str = "upstream_unavailable",
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.reason = reason


class DataQualityError(DataProviderError):
    """Raised when upstream payload fails schema, unit, or integrity validation."""

    def __init__(self, message: str, *, reason: str = "data_quality_error") -> None:
        super().__init__(message)
        self.reason = reason
