# Live Motion Studio

Live Motion Studio is a hybrid browser/server converter for iOS Live Photos and Android/Windows Motion Photos.

Languages:

- [中文介绍与教程](docs/README.zh-CN.md)
- [English guide](docs/README.en.md)

## Highlights

- Image + video to Live Photo or Motion Photo.
- Video frame capture to generate a cover automatically.
- Direct video URL input, including mp4/mov and server-side m3u8 parsing.
- iOS Live Photo and Android/Windows Motion Photo conversion.
- Smart routing: desktop browsers use WASM when possible; mobile devices use the server API.
- Production Docker setup with health checks, rate limits, FFmpeg concurrency limits, and GHCR publishing workflow.

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

Open:

```text
http://localhost:8787
```

For LAN use, open the host IP, for example:

```text
http://192.168.1.11:8787
```

## Production Image

After publishing an image to GHCR:

```bash
cp .env.example .env
# edit LIVE_MOTION_IMAGE=ghcr.io/<owner>/<repo>:latest
docker compose -f docker-compose.prod.yml up -d
```

## License

MIT
