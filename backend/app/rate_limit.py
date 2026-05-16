from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import date

from fastapi import HTTPException, Request, status

from .config import settings


@dataclass
class Counter:
    day: str
    count: int


class DailyIpLimiter:
    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._lock = threading.Lock()
        self._counters: dict[str, Counter] = {}

    def consume(self, ip: str) -> None:
        today = date.today().isoformat()

        with self._lock:
            stale_keys = [key for key, counter in self._counters.items() if counter.day != today]
            for key in stale_keys:
                self._counters.pop(key, None)

            counter = self._counters.get(ip)
            if counter is None:
                self._counters[ip] = Counter(day=today, count=1)
                return

            if counter.count >= self._limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="今天的移动端后端处理次数已用完，请切换到电脑端使用前端处理链路。",
                )

            counter.count += 1


limiter = DailyIpLimiter(settings.daily_ip_limit)


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()

    if request.client:
        return request.client.host

    return "unknown"


def enforce_ip_limit(request: Request) -> None:
    limiter.consume(client_ip(request))
