# Live Motion Studio

Live Motion Studio is a clean, self-hosted converter for iOS Live Photos and Android/Windows Motion Photos.

It works as a small web app: upload local media, capture a cover frame from a video, fetch a direct video URL, or convert between iOS and Android/Windows live photo formats.

<p>
  <a href="docs/README.zh-CN.md">中文教程</a>
  ·
  <a href="docs/README.en.md">English Guide</a>
  ·
  <a href="https://github.com/MaverickXu/live-motion-studio/releases/tag/v1.0.0">Release v1.0.0</a>
</p>

![Live Motion Studio desktop screenshot](docs/assets/screenshot-desktop.png)

## What It Does

![Supported workflows](docs/assets/conversion-flow.svg)

- Create a Live Photo from a cover image and a motion video.
- Use a video frame as the cover image automatically.
- Convert a direct video URL into a Live Photo or Motion Photo.
- Convert iOS Live Photo pairs into one Android/Windows Motion Photo JPG.
- Convert Android/Windows Motion Photo JPG files back into iOS Live Photo output.
- Keep the everyday UI simple, with advanced output options available only when needed.

## Why It Exists

Live Photo conversion is awkward across platforms. Desktop browsers can handle more work locally, while mobile Safari and Android browsers often need a server fallback. Live Motion Studio uses a hybrid route so the user does not have to care about those details.

![Architecture overview](docs/assets/architecture.svg)

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

Open:

```text
http://localhost:8787
```

For another device on the same LAN, open:

```text
http://<your-host-ip>:8787
```

## Docker Image

```bash
docker pull ghcr.io/maverickxu/live-motion-studio:latest
```

Use the production compose file:

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d
```

## Mobile Layout

![Live Motion Studio mobile screenshot](docs/assets/screenshot-mobile.png)

## Documentation

- [中文介绍、部署和使用教程](docs/README.zh-CN.md)
- [English deployment and usage guide](docs/README.en.md)

## License

MIT
