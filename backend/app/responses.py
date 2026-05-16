from __future__ import annotations

from uuid import uuid4

from fastapi import Response


def multipart_mixed(parts: list[tuple[str, str, bytes]], content_id: str | None = None) -> Response:
    boundary = f"live-motion-{uuid4().hex}"
    body = bytearray()

    for content_type, filename, payload in parts:
        body.extend(f"--{boundary}\r\n".encode("ascii"))
        body.extend(f"Content-Type: {content_type}\r\n".encode("ascii"))
        body.extend(f'Content-Disposition: attachment; filename="{filename}"\r\n\r\n'.encode("utf-8"))
        body.extend(payload)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("ascii"))

    headers = {}
    if content_id:
        headers["X-Content-Identifier"] = content_id

    return Response(
        content=bytes(body),
        media_type=f"multipart/mixed; boundary={boundary}",
        headers=headers,
    )
