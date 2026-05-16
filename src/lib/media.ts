import type { OutputSettings } from "./types";

interface MediaTransformOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function normalizeImageToJpeg(file: File, options: MediaTransformOptions = {}): Promise<File> {
  const quality = options.quality ?? 0.94;
  if ((file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) && !hasResizeTarget(options)) {
    return new File([file], file.name.replace(/\.[^.]+$/i, ".jpg"), { type: "image/jpeg" });
  }

  const image = await loadImage(file);
  const size = fitSize(image.naturalWidth, image.naturalHeight, options);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("当前浏览器无法创建图片画布。");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  return new File([blob], file.name.replace(/\.[^.]+$/i, ".jpg"), { type: "image/jpeg" });
}

export async function extractVideoFrame(videoFile: File, frameTimeSeconds: number, options: MediaTransformOptions = {}): Promise<File> {
  const quality = options.quality ?? 0.94;
  const video = document.createElement("video");
  const url = URL.createObjectURL(videoFile);

  try {
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    await waitForEvent(video, "loadedmetadata");

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const targetTime = Math.max(0, Math.min(frameTimeSeconds, Math.max(0, duration - 0.05)));
    video.currentTime = targetTime === 0 ? Math.min(0.001, Math.max(0, duration - 0.05)) : targetTime;

    await waitForEvent(video, "seeked");

    const size = fitSize(video.videoWidth, video.videoHeight, options);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("当前浏览器无法截取视频帧。");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    return new File([blob], `${videoFile.name.replace(/\.[^.]+$/i, "")}-cover.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function makeObjectUrl(file: Blob | null): string {
  return file ? URL.createObjectURL(file) : "";
}

export function outputSettingsToMediaOptions(settings: OutputSettings): MediaTransformOptions {
  return {
    maxWidth: settings.maxWidth,
    maxHeight: settings.maxHeight,
    quality: settings.jpegQuality / 100
  };
}

export function outputSettingsNeedVideoTranscode(settings: OutputSettings): boolean {
  return settings.videoCodec === "h264" || Boolean(settings.maxWidth || settings.maxHeight);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取这张图片，请换用 JPG/PNG/WebP 格式。"));
    };
    image.src = url;
  });
}

function waitForEvent<T extends HTMLElement>(element: T, eventName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      element.removeEventListener(eventName, handleEvent);
      element.removeEventListener("error", handleError);
    };
    const handleEvent = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("媒体文件读取失败。"));
    };

    element.addEventListener(eventName, handleEvent, { once: true });
    element.addEventListener("error", handleError, { once: true });
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("图片导出失败。"));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

function hasResizeTarget(options: MediaTransformOptions): boolean {
  return Boolean(options.maxWidth || options.maxHeight);
}

function fitSize(width: number, height: number, options: MediaTransformOptions): { width: number; height: number } {
  const maxWidth = options.maxWidth ?? width;
  const maxHeight = options.maxHeight ?? height;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}
