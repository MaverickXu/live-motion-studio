from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse, urlunparse

from fastapi import HTTPException, status

from .config import settings


LOCALHOST_NAMES = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def validate_public_http_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅支持 http/https 视频直链。")

    if settings.rewrite_localhost_to_host and parsed.hostname.lower() in LOCALHOST_NAMES:
        url = _rewrite_hostname(parsed, settings.docker_host_name)
        parsed = urlparse(url)

    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="视频 URL 缺少主机名。")

    try:
        ipaddress.ip_address(host)
        addresses = [host]
    except ValueError:
        try:
            addresses = [item[4][0] for item in socket.getaddrinfo(host, parsed.port or 443, type=socket.SOCK_STREAM)]
        except socket.gaierror as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="视频 URL 域名无法解析。") from exc

    for address in addresses:
        ip = ipaddress.ip_address(address)
        if ip.is_multicast or ip.is_reserved:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不允许访问保留或组播地址。")

        if not settings.allow_private_urls and (ip.is_private or ip.is_loopback or ip.is_link_local):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前部署禁止访问内网或本机地址。若用于局域网 Docker 部署，请开启 LIVEPHOTO_ALLOW_PRIVATE_URLS=1。",
            )

    return url


def _rewrite_hostname(parsed, hostname: str) -> str:
    netloc = hostname
    if parsed.port:
        netloc = f"{netloc}:{parsed.port}"

    if parsed.username:
        auth = parsed.username
        if parsed.password:
            auth = f"{auth}:{parsed.password}"
        netloc = f"{auth}@{netloc}"

    return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
