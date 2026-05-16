from __future__ import annotations

import re
import subprocess
import tempfile
import threading
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException, status

from .config import settings
from .security import validate_public_http_url

ffmpeg_slots = threading.Semaphore(settings.ffmpeg_concurrency)


class FFmpegError(RuntimeError):
    pass


@dataclass(frozen=True)
class PreparedInput:
    data: bytes
    input_options: list[str]


@dataclass(frozen=True)
class SourceMedia:
    photo: bytes
    video: bytes


@dataclass(frozen=True)
class IosMedia:
    photo: bytes
    video: bytes


@dataclass(frozen=True)
class OutputOptions:
    max_width: int | None = None
    max_height: int | None = None
    video_codec: str = "auto"
    jpeg_quality: int = 94


def convert_uploaded_video_to_ios_mov(video_bytes: bytes, content_id: str, options: OutputOptions | None = None) -> bytes:
    options = options or OutputOptions()
    with tempfile.TemporaryDirectory(prefix="live-motion-") as temp_dir:
        output_path = Path(temp_dir) / "live.mov"
        args = [
            "-hide_banner",
            "-y",
            "-fflags",
            "+genpts",
            "-i",
            "pipe:0",
            *_video_output_args(options),
            "-movflags",
            "use_metadata_tags+faststart",
            "-map_metadata",
            "0",
            "-metadata:s:v",
            f"com.apple.quicktime.content.identifier={content_id}",
            "-metadata",
            f"com.apple.quicktime.content.identifier={content_id}",
            str(output_path),
        ]

        if _needs_transcode(options):
            _run_ffmpeg(args, video_bytes)
        else:
            try:
                _run_ffmpeg(args, video_bytes)
            except FFmpegError:
                _run_ffmpeg(_replace_copy_with_transcode(args, output_is_mov=True), video_bytes)

        return output_path.read_bytes()


def convert_uploaded_video_to_mp4(video_bytes: bytes, options: OutputOptions | None = None) -> bytes:
    options = options or OutputOptions()
    with tempfile.TemporaryDirectory(prefix="live-motion-") as temp_dir:
        output_path = Path(temp_dir) / "motion.mp4"
        args = [
            "-hide_banner",
            "-y",
            "-fflags",
            "+genpts",
            "-i",
            "pipe:0",
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            *_video_output_args(options),
            "-movflags",
            "faststart",
            str(output_path),
        ]

        if _needs_transcode(options):
            _run_ffmpeg(args, video_bytes)
        else:
            try:
                _run_ffmpeg(args, video_bytes)
            except FFmpegError:
                _run_ffmpeg(_replace_copy_with_transcode(args, output_is_mov=False), video_bytes)

        return output_path.read_bytes()


def resolve_uploaded_video_source(video_bytes: bytes, frame_time_seconds: float, options: OutputOptions | None = None) -> SourceMedia:
    options = options or OutputOptions()

    with tempfile.TemporaryDirectory(prefix="live-motion-") as temp_dir:
        cover_path = Path(temp_dir) / "cover.jpg"
        video_path = Path(temp_dir) / "motion.mp4"
        args = [
            "-hide_banner",
            "-y",
            "-fflags",
            "+genpts",
            "-i",
            "pipe:0",
            "-map",
            "0:v:0",
            "-vf",
            _frame_filter(frame_time_seconds, options),
            "-frames:v",
            "1",
            "-q:v",
            _jpeg_qscale(options.jpeg_quality),
            str(cover_path),
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            *_video_output_args(options),
            "-movflags",
            "faststart",
            str(video_path),
        ]

        if _needs_transcode(options):
            _run_ffmpeg(args, video_bytes)
        else:
            try:
                _run_ffmpeg(args, video_bytes)
            except FFmpegError:
                _run_ffmpeg(_replace_copy_with_transcode(args, output_is_mov=False), video_bytes)

        return SourceMedia(photo=cover_path.read_bytes(), video=video_path.read_bytes())


def resolve_url_source(url: str, frame_time_seconds: float, options: OutputOptions | None = None) -> SourceMedia:
    options = options or OutputOptions()
    prepared = prepare_url_input(url)

    with tempfile.TemporaryDirectory(prefix="live-motion-") as temp_dir:
        cover_path = Path(temp_dir) / "cover.jpg"
        video_path = Path(temp_dir) / "motion.mp4"
        args = [
            "-hide_banner",
            "-y",
            "-fflags",
            "+genpts",
            *prepared.input_options,
            "-i",
            "pipe:0",
            "-map",
            "0:v:0",
            "-vf",
            _frame_filter(frame_time_seconds, options),
            "-frames:v",
            "1",
            "-q:v",
            _jpeg_qscale(options.jpeg_quality),
            str(cover_path),
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            *_video_output_args(options),
            "-movflags",
            "faststart",
            str(video_path),
        ]

        if _needs_transcode(options):
            _run_ffmpeg(args, prepared.data)
        else:
            try:
                _run_ffmpeg(args, prepared.data)
            except FFmpegError:
                transcode_args = _replace_copy_with_transcode(args, output_is_mov=False)
                _run_ffmpeg(transcode_args, prepared.data)

        return SourceMedia(photo=cover_path.read_bytes(), video=video_path.read_bytes())


def convert_url_to_ios_media(url: str, frame_time_seconds: float, content_id: str, options: OutputOptions | None = None) -> IosMedia:
    options = options or OutputOptions()
    prepared = prepare_url_input(url)

    with tempfile.TemporaryDirectory(prefix="live-motion-") as temp_dir:
        cover_path = Path(temp_dir) / "cover.jpg"
        mov_path = Path(temp_dir) / "live.mov"
        args = [
            "-hide_banner",
            "-y",
            "-fflags",
            "+genpts",
            *prepared.input_options,
            "-i",
            "pipe:0",
            "-map",
            "0:v:0",
            "-vf",
            _frame_filter(frame_time_seconds, options),
            "-frames:v",
            "1",
            "-q:v",
            _jpeg_qscale(options.jpeg_quality),
            str(cover_path),
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            *_video_output_args(options),
            "-movflags",
            "use_metadata_tags+faststart",
            "-map_metadata",
            "0",
            "-metadata:s:v",
            f"com.apple.quicktime.content.identifier={content_id}",
            "-metadata",
            f"com.apple.quicktime.content.identifier={content_id}",
            str(mov_path),
        ]

        if _needs_transcode(options):
            _run_ffmpeg(args, prepared.data)
        else:
            try:
                _run_ffmpeg(args, prepared.data)
            except FFmpegError:
                transcode_args = _replace_copy_with_transcode(args, output_is_mov=True)
                _run_ffmpeg(transcode_args, prepared.data)

        return IosMedia(photo=cover_path.read_bytes(), video=mov_path.read_bytes())


def prepare_url_input(url: str) -> PreparedInput:
    url = validate_public_http_url(url)
    parsed = urlparse(url)
    lower_path = parsed.path.lower()

    if lower_path.endswith(".m3u8"):
        playlist = _prepare_hls_playlist(url, depth=0)
        return PreparedInput(
            data=playlist.encode("utf-8"),
            input_options=["-protocol_whitelist", "pipe,http,https,tcp,tls,crypto", "-allowed_extensions", "ALL"],
        )

    return PreparedInput(data=_download_public_url(url), input_options=[])


def _run_ffmpeg(args: list[str], input_bytes: bytes) -> None:
    with ffmpeg_slots:
        process = subprocess.Popen(
            [settings.ffmpeg_bin, *args],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )

        try:
            _, stderr = process.communicate(input=input_bytes, timeout=settings.ffmpeg_timeout_seconds)
        except subprocess.TimeoutExpired as exc:
            process.kill()
            process.communicate()
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="FFmpeg 处理超时。") from exc

    if process.returncode != 0:
        message = stderr.decode("utf-8", errors="replace")[-2000:]
        raise FFmpegError(message)


def _download_public_url(url: str) -> bytes:
    current_url = validate_public_http_url(url)

    with httpx.Client(timeout=settings.request_timeout_seconds, follow_redirects=False) as client:
        for _ in range(6):
            try:
                with client.stream("GET", current_url) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location:
                            break
                        current_url = validate_public_http_url(urljoin(current_url, location))
                        continue

                    response.raise_for_status()
                    buffer = BytesIO()
                    for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                        buffer.write(chunk)
                        if buffer.tell() > settings.max_url_bytes:
                            raise HTTPException(
                                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail=f"远程视频超过 {settings.max_url_mb}MB。",
                            )
                    return buffer.getvalue()
            except httpx.HTTPStatusError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="远程视频下载失败。") from exc
            except httpx.HTTPError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="远程视频连接失败。") from exc

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="远程视频重定向次数过多。")


def _get_public_text(url: str) -> str:
    data = _download_public_url(url)
    return data.decode("utf-8", errors="replace")


def _prepare_hls_playlist(url: str, depth: int) -> str:
    if depth > settings.max_hls_depth:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="HLS 播放列表嵌套过深。")

    playlist_url = validate_public_http_url(url)
    text = _get_public_text(playlist_url)
    lines = text.splitlines()
    variant_url = _select_hls_variant(lines, playlist_url)
    if variant_url:
        return _prepare_hls_playlist(variant_url, depth + 1)

    rewritten: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            rewritten.append(line)
            continue

        if stripped.startswith("#EXT-X-KEY") or stripped.startswith("#EXT-X-MAP"):
            rewritten.append(_rewrite_hls_uri_attribute(line, playlist_url))
            continue

        if stripped.startswith("#"):
            rewritten.append(line)
            continue

        absolute = validate_public_http_url(urljoin(playlist_url, stripped))
        rewritten.append(absolute)

    return "\n".join(rewritten) + "\n"


def _select_hls_variant(lines: list[str], playlist_url: str) -> str | None:
    best_bandwidth = -1
    best_url: str | None = None

    for index, line in enumerate(lines):
        if not line.startswith("#EXT-X-STREAM-INF"):
            continue

        bandwidth_match = re.search(r"BANDWIDTH=(\d+)", line)
        bandwidth = int(bandwidth_match.group(1)) if bandwidth_match else 0

        for candidate in lines[index + 1 :]:
            candidate = candidate.strip()
            if not candidate or candidate.startswith("#"):
                continue

            if bandwidth > best_bandwidth:
                best_bandwidth = bandwidth
                best_url = validate_public_http_url(urljoin(playlist_url, candidate))
            break

    return best_url


def _rewrite_hls_uri_attribute(line: str, playlist_url: str) -> str:
    match = re.search(r'URI="([^"]+)"', line)
    if not match:
        return line

    absolute = validate_public_http_url(urljoin(playlist_url, match.group(1)))
    return line[: match.start(1)] + absolute + line[match.end(1) :]


def _frame_filter(frame_time_seconds: float, options: OutputOptions) -> str:
    frame_time = max(0.0, frame_time_seconds)
    scale = _scale_filter(options)
    if scale:
        return f"select='gte(t,{frame_time})',{scale}"

    return f"select='gte(t,{frame_time})'"


def _replace_copy_with_transcode(args: list[str], output_is_mov: bool) -> list[str]:
    replaced: list[str] = []
    iterator: Iterable[str] = iter(args)

    for item in iterator:
        if item == "-c":
            next(iterator, None)
            replaced.extend(["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k"])
            continue
        replaced.append(item)

    if output_is_mov:
        return replaced

    return replaced


def _needs_transcode(options: OutputOptions) -> bool:
    return options.video_codec == "h264" or bool(options.max_width or options.max_height)


def _video_output_args(options: OutputOptions) -> list[str]:
    if not _needs_transcode(options):
        return ["-c", "copy"]

    args: list[str] = []
    scale = _scale_filter(options)
    if scale:
        args.extend(["-vf", scale])

    args.extend(["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k"])
    return args


def _scale_filter(options: OutputOptions) -> str | None:
    if not options.max_width and not options.max_height:
        return None

    max_width = options.max_width or 99999
    max_height = options.max_height or 99999
    return f"scale='min({max_width},iw)':'min({max_height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2"


def _jpeg_qscale(quality: int) -> str:
    quality = max(60, min(98, quality))
    qscale = round(31 - ((quality - 60) / 38) * 29)
    return str(max(2, min(31, qscale)))
