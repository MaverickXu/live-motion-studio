import type { LivePhotoFiles, OutputSettings, SourceBundle, UrlSourceRequest } from "./types";
import { bytesToArrayBuffer } from "./jpeg-xmp";

interface MixedPart {
  headers: Record<string, string>;
  data: Uint8Array;
}

const API_BASE = "/api";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function convertIosFromFiles(photo: File, video: File, contentId: string, outputName: string, settings: OutputSettings): Promise<LivePhotoFiles> {
  const formData = new FormData();
  formData.append("photo", photo);
  formData.append("video", video);
  formData.append("content_id", contentId);
  formData.append("output_name", outputName);
  appendOutputSettings(formData, settings);

  const response = await fetch(`${API_BASE}/live-photo/ios`, {
    method: "POST",
    body: formData
  });

  return parseLivePhotoResponse(response, contentId, outputName);
}

export async function convertIosFromUrl(request: UrlSourceRequest, outputName: string): Promise<LivePhotoFiles> {
  const response = await fetch(`${API_BASE}/live-photo/ios/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  return parseLivePhotoResponse(response, request.contentId ?? "", outputName);
}

export async function resolveUrlSource(request: UrlSourceRequest, outputName: string): Promise<SourceBundle> {
  const response = await fetch(`${API_BASE}/source/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  await assertOk(response);

  const parts = await parseMultipartResponse(response);
  const photoPart = findPart(parts, "image/jpeg");
  const videoPart = findPart(parts, "video/mp4");

  if (!photoPart || !videoPart) {
    throw new Error("服务器没有返回完整的封面和视频。");
  }

  return {
    photo: new File([bytesToArrayBuffer(photoPart.data)], `${outputName}.jpg`, { type: "image/jpeg" }),
    video: new File([bytesToArrayBuffer(videoPart.data)], `${outputName}.mp4`, { type: "video/mp4" }),
    sourceName: outputName
  };
}

export async function resolveFileSource(
  photo: File | null,
  video: File,
  frameTimeSeconds: number,
  contentId: string,
  outputName: string,
  settings: OutputSettings
): Promise<SourceBundle> {
  const formData = new FormData();
  if (photo) {
    formData.append("photo", photo);
  }
  formData.append("video", video);
  formData.append("frame_time_seconds", String(frameTimeSeconds));
  formData.append("content_id", contentId);
  appendOutputSettings(formData, settings);

  const response = await fetch(`${API_BASE}/source/files`, {
    method: "POST",
    body: formData
  });

  await assertOk(response);

  const parts = await parseMultipartResponse(response);
  const photoPart = findPart(parts, "image/jpeg");
  const videoPart = findPart(parts, "video/mp4");

  if (!photoPart || !videoPart) {
    throw new Error("服务器没有返回完整的封面和视频。");
  }

  return {
    photo: new File([bytesToArrayBuffer(photoPart.data)], `${outputName}.jpg`, { type: "image/jpeg" }),
    video: new File([bytesToArrayBuffer(videoPart.data)], `${outputName}.mp4`, { type: "video/mp4" }),
    sourceName: outputName
  };
}

async function parseLivePhotoResponse(response: Response, fallbackId: string, outputName: string): Promise<LivePhotoFiles> {
  await assertOk(response);

  const contentId = response.headers.get("X-Content-Identifier") || fallbackId;
  const parts = await parseMultipartResponse(response);
  const photoPart = findPart(parts, "image/jpeg");
  const videoPart = findPart(parts, "video/quicktime");

  if (!photoPart || !videoPart) {
    throw new Error("服务器没有返回完整的 Live Photo 文件。");
  }

  return {
    contentId,
    photo: new File([bytesToArrayBuffer(photoPart.data)], `${outputName}.jpg`, { type: "image/jpeg" }),
    video: new File([bytesToArrayBuffer(videoPart.data)], `${outputName}.mov`, { type: "video/quicktime" })
  };
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await response.json() as { detail?: string; message?: string };
    throw new Error(payload.detail || payload.message || `请求失败：${response.status}`);
  }

  throw new Error(await response.text() || `请求失败：${response.status}`);
}

async function parseMultipartResponse(response: Response): Promise<MixedPart[]> {
  const contentType = response.headers.get("Content-Type") ?? "";
  const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];

  if (!boundary) {
    throw new Error("服务器响应缺少 multipart boundary。");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return parseMultipartMixed(bytes, boundary);
}

function parseMultipartMixed(bytes: Uint8Array, boundary: string): MixedPart[] {
  const boundaryBytes = encoder.encode(`--${boundary}`);
  const nextBoundaryBytes = encoder.encode(`\r\n--${boundary}`);
  const headerEndBytes = encoder.encode("\r\n\r\n");
  const parts: MixedPart[] = [];

  let cursor = indexOf(bytes, boundaryBytes, 0);
  while (cursor >= 0) {
    cursor += boundaryBytes.byteLength;

    if (bytes[cursor] === 45 && bytes[cursor + 1] === 45) {
      break;
    }

    if (bytes[cursor] === 13 && bytes[cursor + 1] === 10) {
      cursor += 2;
    }

    const headerEnd = indexOf(bytes, headerEndBytes, cursor);
    if (headerEnd < 0) {
      break;
    }

    const headers = parseHeaders(decoder.decode(bytes.slice(cursor, headerEnd)));
    const contentStart = headerEnd + headerEndBytes.byteLength;
    const nextBoundary = indexOf(bytes, nextBoundaryBytes, contentStart);
    if (nextBoundary < 0) {
      break;
    }

    parts.push({
      headers,
      data: bytes.slice(contentStart, nextBoundary)
    });

    cursor = nextBoundary + 2;
  }

  return parts;
}

function parseHeaders(rawHeaders: string): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const line of rawHeaders.split("\r\n")) {
    const splitAt = line.indexOf(":");
    if (splitAt <= 0) {
      continue;
    }

    headers[line.slice(0, splitAt).trim().toLowerCase()] = line.slice(splitAt + 1).trim();
  }

  return headers;
}

function findPart(parts: MixedPart[], contentType: string): MixedPart | undefined {
  return parts.find((part) => part.headers["content-type"]?.toLowerCase().startsWith(contentType));
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, fromIndex: number): number {
  outer: for (let index = Math.max(0, fromIndex); index <= haystack.byteLength - needle.byteLength; index += 1) {
    for (let needleIndex = 0; needleIndex < needle.byteLength; needleIndex += 1) {
      if (haystack[index + needleIndex] !== needle[needleIndex]) {
        continue outer;
      }
    }

    return index;
  }

  return -1;
}

function appendOutputSettings(formData: FormData, settings: OutputSettings): void {
  formData.append("resolution_preset", settings.resolutionPreset);
  formData.append("video_codec", settings.videoCodec);
  formData.append("jpeg_quality", String(settings.jpegQuality));

  if (settings.maxWidth) {
    formData.append("max_width", String(settings.maxWidth));
  }
  if (settings.maxHeight) {
    formData.append("max_height", String(settings.maxHeight));
  }
}
