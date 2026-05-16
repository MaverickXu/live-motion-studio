from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import settings
from .ffmpeg import (
    FFmpegError,
    OutputOptions,
    convert_uploaded_video_to_ios_mov,
    convert_uploaded_video_to_mp4,
    convert_url_to_ios_media,
    resolve_uploaded_video_source,
    resolve_url_source,
)
from .jpeg_xmp import build_apple_xmp, ensure_jpeg, inject_xmp_packet
from .rate_limit import enforce_ip_limit
from .responses import multipart_mixed

app = FastAPI(title="Live Motion Studio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["X-Content-Identifier", "Content-Type"],
)


@app.exception_handler(FFmpegError)
async def ffmpeg_error_handler(_: Request, exc: FFmpegError) -> JSONResponse:
    detail = str(exc).strip().splitlines()[-1] if str(exc).strip() else "FFmpeg 处理失败。"
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": detail})


@app.middleware("http")
async def content_length_guard(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        max_request_bytes = settings.max_upload_bytes * 2 + 1024 * 1024
        try:
            request_bytes = int(content_length) if content_length else 0
        except ValueError:
            request_bytes = 0

        if request_bytes > max_request_bytes:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": f"请求体超过 {settings.max_upload_mb * 2}MB。"},
            )

    return await call_next(request)


@app.middleware("http")
async def cross_origin_isolation_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response


class UrlRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)
    frameTimeSeconds: float = Field(default=0, ge=0, le=3600)
    contentId: str | None = Field(default=None, max_length=128)
    resolutionPreset: str = Field(default="source", max_length=16)
    maxWidth: int | None = Field(default=None, ge=160, le=4096)
    maxHeight: int | None = Field(default=None, ge=160, le=4096)
    videoCodec: str = Field(default="auto", max_length=16)
    jpegQuality: int = Field(default=94, ge=60, le=98)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/live-photo/ios", dependencies=[Depends(enforce_ip_limit)])
async def live_photo_ios(
    photo: bytes = File(...),
    video: bytes = File(...),
    content_id: str | None = Form(default=None),
    output_name: str = Form(default="live-photo"),
    resolution_preset: str = Form(default="source"),
    max_width: int | None = Form(default=None),
    max_height: int | None = Form(default=None),
    video_codec: str = Form(default="auto"),
    jpeg_quality: int = Form(default=94),
):
    content_id = content_id or str(uuid4())
    _enforce_upload_size(photo)
    _enforce_upload_size(video)
    options = _output_options(resolution_preset, max_width, max_height, video_codec, jpeg_quality)

    jpeg = ensure_jpeg(photo, options.max_width, options.max_height, options.jpeg_quality)
    live_jpeg = inject_xmp_packet(jpeg, build_apple_xmp(content_id))
    live_mov = convert_uploaded_video_to_ios_mov(video, content_id, options)
    safe_name = _safe_name(output_name)

    return multipart_mixed(
        [
            ("image/jpeg", f"{safe_name}.jpg", live_jpeg),
            ("video/quicktime", f"{safe_name}.mov", live_mov),
        ],
        content_id=content_id,
    )


@app.post("/api/live-photo/ios/url", dependencies=[Depends(enforce_ip_limit)])
def live_photo_ios_from_url(payload: UrlRequest):
    content_id = payload.contentId or str(uuid4())
    options = _output_options(payload.resolutionPreset, payload.maxWidth, payload.maxHeight, payload.videoCodec, payload.jpegQuality)
    media = convert_url_to_ios_media(payload.url, payload.frameTimeSeconds, content_id, options)
    live_jpeg = inject_xmp_packet(ensure_jpeg(media.photo, options.max_width, options.max_height, options.jpeg_quality), build_apple_xmp(content_id))

    return multipart_mixed(
        [
            ("image/jpeg", "remote-live-photo.jpg", live_jpeg),
            ("video/quicktime", "remote-live-photo.mov", media.video),
        ],
        content_id=content_id,
    )


@app.post("/api/source/url", dependencies=[Depends(enforce_ip_limit)])
def source_from_url(payload: UrlRequest):
    options = _output_options(payload.resolutionPreset, payload.maxWidth, payload.maxHeight, payload.videoCodec, payload.jpegQuality)
    media = resolve_url_source(payload.url, payload.frameTimeSeconds, options)

    return multipart_mixed(
        [
            ("image/jpeg", "remote-cover.jpg", ensure_jpeg(media.photo, options.max_width, options.max_height, options.jpeg_quality)),
            ("video/mp4", "remote-motion.mp4", media.video),
        ],
        content_id=payload.contentId,
    )


@app.post("/api/source/files", dependencies=[Depends(enforce_ip_limit)])
async def source_from_files(
    video: bytes = File(...),
    photo: bytes | None = File(default=None),
    frame_time_seconds: float = Form(default=0),
    content_id: str | None = Form(default=None),
    resolution_preset: str = Form(default="source"),
    max_width: int | None = Form(default=None),
    max_height: int | None = Form(default=None),
    video_codec: str = Form(default="auto"),
    jpeg_quality: int = Form(default=94),
):
    _enforce_upload_size(video)
    if photo is not None:
        _enforce_upload_size(photo)

    options = _output_options(resolution_preset, max_width, max_height, video_codec, jpeg_quality)
    if photo is not None:
        cover = ensure_jpeg(photo, options.max_width, options.max_height, options.jpeg_quality)
        motion = convert_uploaded_video_to_mp4(video, options)
    else:
        media = resolve_uploaded_video_source(video, frame_time_seconds, options)
        cover = ensure_jpeg(media.photo, options.max_width, options.max_height, options.jpeg_quality)
        motion = media.video

    return multipart_mixed(
        [
            ("image/jpeg", "source-cover.jpg", cover),
            ("video/mp4", "source-motion.mp4", motion),
        ],
        content_id=content_id,
    )


def _enforce_upload_size(data: bytes) -> None:
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"上传文件超过 {settings.max_upload_mb}MB。",
        )


def _safe_name(name: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in {"-", "_", "."} else "-" for char in name)
    cleaned = cleaned.strip(".-")[:80]
    return cleaned or "live-photo"


def _output_options(
    resolution_preset: str,
    max_width: int | None,
    max_height: int | None,
    video_codec: str,
    jpeg_quality: int,
) -> OutputOptions:
    preset = resolution_preset.strip().lower()
    codec = video_codec.strip().lower()

    if preset == "long-1920":
        max_width = 1920
        max_height = 1920
    elif preset == "long-1280":
        max_width = 1280
        max_height = 1280
    elif preset != "custom":
        max_width = None
        max_height = None

    if codec not in {"auto", "h264"}:
        codec = "auto"

    return OutputOptions(
        max_width=_clean_dimension(max_width),
        max_height=_clean_dimension(max_height),
        video_codec=codec,
        jpeg_quality=max(60, min(98, jpeg_quality)),
    )


def _clean_dimension(value: int | None) -> int | None:
    if value is None:
        return None

    value = max(160, min(4096, value))
    return value - value % 2


dist_dir = Path(__file__).resolve().parents[2] / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
