import { blobToBytes, buildAndroidMotionXmp, bytesToArrayBuffer, injectXmpPacket, mergeJpegAndVideo } from "./jpeg-xmp";
import type { AndroidMotionResult, SourceBundle } from "./types";

export async function makeAndroidMotionPhoto(
  photo: Blob,
  video: Blob,
  contentId: string,
  outputName: string,
  presentationTimestampUs = 0
): Promise<AndroidMotionResult> {
  const [photoBytes, videoBytes] = await Promise.all([blobToBytes(photo), blobToBytes(video)]);
  const xmp = buildAndroidMotionXmp(contentId, videoBytes.byteLength, presentationTimestampUs);
  const jpegWithXmp = injectXmpPacket(photoBytes, xmp);
  const combined = mergeJpegAndVideo(jpegWithXmp, videoBytes);
  const file = new File([bytesToArrayBuffer(combined)], `${outputName}.MP.jpg`, { type: "image/jpeg" });

  return { contentId, file };
}

export async function splitAndroidMotionPhoto(file: File, outputName: string): Promise<SourceBundle> {
  const bytes = await blobToBytes(file);
  const videoStart = findMotionVideoStart(bytes);

  if (videoStart <= 0 || videoStart >= bytes.byteLength) {
    throw new Error("Motion Photo video payload was not found.");
  }

  const photoBytes = bytes.slice(0, videoStart);
  const videoBytes = bytes.slice(videoStart);

  return {
    photo: new File([bytesToArrayBuffer(photoBytes)], `${outputName}-cover.jpg`, { type: "image/jpeg" }),
    video: new File([bytesToArrayBuffer(videoBytes)], `${outputName}-motion.mp4`, { type: "video/mp4" }),
    sourceName: outputName
  };
}

function findMotionVideoStart(bytes: Uint8Array): number {
  const xmp = readXmpText(bytes);
  const lengthFromXmp = xmp ? findMotionVideoLength(xmp) : 0;
  if (lengthFromXmp > 0 && lengthFromXmp < bytes.byteLength) {
    return bytes.byteLength - lengthFromXmp;
  }

  return findMp4Start(bytes);
}

function readXmpText(bytes: Uint8Array): string {
  const header = new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0");
  let offset = 2;

  while (offset + 4 <= bytes.byteLength && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda) {
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      offset += 2;
      continue;
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.byteLength) {
      break;
    }

    const payload = bytes.slice(offset + 4, end);
    if (marker === 0xe1 && startsWithBytes(payload, header)) {
      return new TextDecoder().decode(payload.slice(header.byteLength));
    }

    offset = end;
  }

  return "";
}

function findMotionVideoLength(xmp: string): number {
  const values = [
    ...[...xmp.matchAll(/Item:Length="(\d+)"/g)].map((match) => Number(match[1])),
    ...[...xmp.matchAll(/GCamera:MicroVideoOffset="(\d+)"/g)].map((match) => Number(match[1])),
    ...[...xmp.matchAll(/Camera:MicroVideoOffset="(\d+)"/g)].map((match) => Number(match[1]))
  ].filter((value) => Number.isFinite(value) && value > 0);

  return values.at(-1) ?? 0;
}

function findMp4Start(bytes: Uint8Array): number {
  for (let index = 4; index + 8 < bytes.byteLength; index += 1) {
    if (bytes[index] !== 0x66 || bytes[index + 1] !== 0x74 || bytes[index + 2] !== 0x79 || bytes[index + 3] !== 0x70) {
      continue;
    }

    const start = index - 4;
    const size = (bytes[start] << 24) | (bytes[start + 1] << 16) | (bytes[start + 2] << 8) | bytes[start + 3];
    if (size >= 8 && start + size <= bytes.byteLength) {
      return start;
    }
  }

  return -1;
}

function startsWithBytes(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.byteLength < prefix.byteLength) {
    return false;
  }

  for (let index = 0; index < prefix.byteLength; index += 1) {
    if (bytes[index] !== prefix[index]) {
      return false;
    }
  }

  return true;
}
