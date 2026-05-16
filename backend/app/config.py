from __future__ import annotations

import os
from dataclasses import dataclass


def _bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    ffmpeg_bin: str = os.getenv("FFMPEG_BIN", "ffmpeg")
    max_upload_mb: int = int(os.getenv("LIVEPHOTO_MAX_UPLOAD_MB", "160"))
    max_url_mb: int = int(os.getenv("LIVEPHOTO_MAX_URL_MB", "160"))
    max_hls_depth: int = int(os.getenv("LIVEPHOTO_MAX_HLS_DEPTH", "3"))
    ffmpeg_timeout_seconds: int = int(os.getenv("LIVEPHOTO_FFMPEG_TIMEOUT", "180"))
    ffmpeg_concurrency: int = int(os.getenv("LIVEPHOTO_FFMPEG_CONCURRENCY", "2"))
    daily_ip_limit: int = int(os.getenv("LIVEPHOTO_DAILY_IP_LIMIT", "10"))
    request_timeout_seconds: float = float(os.getenv("LIVEPHOTO_REQUEST_TIMEOUT", "20"))
    allow_private_urls: bool = _bool(os.getenv("LIVEPHOTO_ALLOW_PRIVATE_URLS", "1"))
    rewrite_localhost_to_host: bool = _bool(os.getenv("LIVEPHOTO_LOCALHOST_TO_HOST", "1"))
    docker_host_name: str = os.getenv("LIVEPHOTO_DOCKER_HOST_NAME", "host.docker.internal")
    allowed_origins: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        origins = os.getenv(
            "LIVEPHOTO_ALLOWED_ORIGINS",
            "*",
        )
        object.__setattr__(self, "allowed_origins", _csv(origins))

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def max_url_bytes(self) -> int:
        return self.max_url_mb * 1024 * 1024


settings = Settings()
