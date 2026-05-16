# Live Motion Studio 中文教程

Live Motion Studio 是一个端云结合的实况照片转换工具，用来在 iOS Live Photo、Android/Windows Motion Photo、普通图片和普通视频之间转换。

## 功能

- 图片 + 视频生成 iOS Live Photo 或 Android/Windows Motion Photo。
- 只上传视频时，自动截取指定时间的帧作为封面。
- 输入视频直链，支持 mp4/mov 和后端解析 m3u8。
- iOS Live Photo 转 Android/Windows Motion Photo。
- Android/Windows Motion Photo 转 iOS Live Photo。
- 根据 UA 自动选择默认输出：iPhone/iPad 默认 iOS，Android/Windows 默认 Android/Windows。
- 进阶设置默认隐藏，用户可以展开后调整链路、分辨率、编码和 JPEG 质量。
- iOS 保存优先使用 Web Share API，Safari 手势过期时会弹出二次点击保存弹窗。

## 架构

- 前端：Vite + React + TypeScript。
- 桌面端：支持 `SharedArrayBuffer` 和 `crossOriginIsolated` 时，iOS 本地文件优先走 `ffmpeg.wasm`。
- 移动端：自动走 FastAPI 后端，避免 iOS Safari 对 SharedArrayBuffer 的限制。
- 后端：Python + FastAPI + FFmpeg。
- 输入视频：后端使用 `pipe:0` 读取，避免大文件落盘。
- 输出视频：因为 `faststart` 需要可 seek 输出，临时写入 `TemporaryDirectory`，读取后立即销毁。
- 保护机制：FFmpeg 并发锁、IP 每日限流、URL SSRF 保护、上传大小限制。

## iOS 元数据

iOS Live Photo 需要 JPG 和 MOV 使用同一个 Content Identifier。

MOV 封装时会同时写入全局和视频流级别元数据：

```bash
-fflags +genpts -c copy -movflags use_metadata_tags+faststart -map_metadata 0 \
-metadata:s:v com.apple.quicktime.content.identifier={UUID} \
-metadata com.apple.quicktime.content.identifier={UUID}
```

如果源视频无法直接 copy 到目标容器，后端会降级为 H.264/AAC 转码，并继续写入同一个标识。

## Android/Windows Motion Photo 元数据

Android/Windows 输出为单个 JPG 文件：

1. 将 UUID 写入 JPG XMP。
2. 写入 `GCamera:MotionPhoto`、`GCamera:MicroVideoOffset`、`Container:Directory` 等标签。
3. 将 MP4 二进制直接拼接到 JPG 末尾。

## Docker 部署

### 1. 源码构建部署

```bash
cp .env.example .env
docker compose up -d --build
```

访问：

```text
http://localhost:8787
```

局域网访问：

```text
http://<服务器局域网IP>:8787
```

例如：

```text
http://192.168.1.11:8787
```

### 2. 使用已发布镜像

```bash
cp .env.example .env
```

编辑 `.env`：

```env
LIVE_MOTION_IMAGE=ghcr.io/<owner>/<repo>:latest
LIVE_MOTION_PORT=8787
```

启动：

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3. 查看状态

```bash
docker compose ps
docker compose logs -f
```

健康检查：

```bash
curl http://localhost:8787/api/health
```

正常返回：

```json
{"status":"ok"}
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LIVE_MOTION_PORT` | `8787` | 宿主机暴露端口 |
| `LIVEPHOTO_ALLOWED_ORIGINS` | `*` | CORS 来源 |
| `LIVEPHOTO_ALLOW_PRIVATE_URLS` | `1` | 是否允许后端访问内网 URL |
| `LIVEPHOTO_LOCALHOST_TO_HOST` | `1` | 容器内是否把 localhost 改写到宿主机 |
| `LIVEPHOTO_DOCKER_HOST_NAME` | `host.docker.internal` | 宿主机映射名 |
| `LIVEPHOTO_DAILY_IP_LIMIT` | `10` | 每 IP 每日转换次数 |
| `LIVEPHOTO_FFMPEG_CONCURRENCY` | `2` | 同时运行的 FFmpeg 数量 |
| `LIVEPHOTO_MAX_UPLOAD_MB` | `160` | 单个上传文件最大 MB |
| `LIVEPHOTO_MAX_URL_MB` | `160` | URL 下载最大 MB |
| `LIVEPHOTO_FFMPEG_TIMEOUT` | `180` | FFmpeg 超时时间秒 |
| `LIVEPHOTO_REQUEST_TIMEOUT` | `20` | URL 请求超时时间秒 |

内网部署建议保留：

```env
LIVEPHOTO_ALLOW_PRIVATE_URLS=1
LIVEPHOTO_LOCALHOST_TO_HOST=1
```

公网部署建议改为：

```env
LIVEPHOTO_ALLOW_PRIVATE_URLS=0
LIVEPHOTO_ALLOWED_ORIGINS=https://your-domain.example
```

## 反向代理

如果使用 Nginx/Caddy/Traefik，请保留以下响应头，否则桌面端 WASM 链路可能不可用：

```nginx
add_header Cross-Origin-Opener-Policy same-origin always;
add_header Cross-Origin-Embedder-Policy require-corp always;
```

示例 Nginx：

```nginx
server {
  listen 80;
  server_name live-photo.example.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cross-Origin-Opener-Policy same-origin always;
    add_header Cross-Origin-Embedder-Policy require-corp always;
  }
}
```

## 使用教程

### 图片 + 视频转实况照片

1. 选择“图片视频”。
2. 上传封面图片和动态视频。
3. 确认输出格式，默认会按设备自动选择。
4. 点击“开始转换”。
5. iOS 用户在系统分享面板中选择“存储图像”；Android/Windows 用户下载单个 Motion Photo JPG。

### 视频截帧 + 视频转实况照片

1. 选择“视频截帧”。
2. 上传视频。
3. 调整“封面时间”，页面会自动预览封面。
4. 点击“开始转换”。

### URL 转实况照片

1. 选择“URL”。
2. 粘贴 mp4/mov/m3u8 视频直链。
3. 如遇跨域或 m3u8，保持“自动”或在进阶设置里选择“后端”。
4. 点击“开始转换”。

### iOS 转 Android/Windows

1. 选择“实况互转”。
2. 输出选择“Android/Windows”。
3. 上传 iOS Live Photo 的 JPG 和 MOV。
4. 点击“开始转换”，得到单个 Motion Photo JPG。

### Android/Windows 转 iOS

1. 选择“实况互转”。
2. 输出选择“iOS”。
3. 上传 Android/Windows Motion Photo JPG。
4. 系统会自动拆出内嵌 MP4 并生成 iOS Live Photo。

## 本地开发

```bash
npm install
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt
.venv/Scripts/uvicorn backend.app.main:app --host 127.0.0.1 --port 8787 --reload
npm run dev
```

前端开发地址：

```text
http://localhost:5173
```

## GitHub 发行

仓库包含 `.github/workflows/docker.yml`：

- Pull Request 会执行前端构建和后端编译。
- 推送到 `main` 或 `v*` 标签时，会构建 Docker 镜像并发布到 GHCR。

发布版本示例：

```bash
git tag v1.0.0
git push origin main v1.0.0
```

镜像地址格式：

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:v1.0.0
```

## 参考

- 原始思路参考：[flashlab/motion-live-photo](https://github.com/flashlab/motion-live-photo)
- Android Motion Photo 格式：<https://developer.android.com/media/platform/motion-photo-format>
- Apple LivePhotosKit JS：<https://developer.apple.com/documentation/LivePhotosKitJS>
