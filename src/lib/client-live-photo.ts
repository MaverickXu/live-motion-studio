import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { blobToBytes, buildAppleLivePhotoXmp, bytesToArrayBuffer, injectXmpPacket } from "./jpeg-xmp";
import type { LivePhotoFiles, OutputSettings } from "./types";

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFfmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = loadFfmpeg();
  }

  return ffmpegPromise;
}

async function loadFfmpeg(): Promise<FFmpeg> {
  const ffmpeg = new FFmpeg();
  ffmpeg.on("log", ({ message }) => {
    if (import.meta.env.DEV) {
      console.debug("[ffmpeg.wasm]", message);
    }
  });

  await ffmpeg.load({
    coreURL: "/ffmpeg-core/ffmpeg-core.js",
    wasmURL: "/ffmpeg-core/ffmpeg-core.wasm",
    workerURL: "/ffmpeg-core/ffmpeg-core.worker.js"
  });

  return ffmpeg;
}

export async function makeIosLivePhotoClient(
  photo: File,
  video: File,
  contentId: string,
  outputName: string,
  settings: OutputSettings
): Promise<LivePhotoFiles> {
  const ffmpeg = await getFfmpeg();
  const inputName = `input-${contentId}.mp4`;
  const outputNameMov = `output-${contentId}.mov`;

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(video));
    await ffmpeg.exec([
      "-fflags",
      "+genpts",
      "-i",
      inputName,
      ...buildVideoArgs(settings),
      "-movflags",
      "use_metadata_tags+faststart",
      "-map_metadata",
      "0",
      "-metadata:s:v",
      `com.apple.quicktime.content.identifier=${contentId}`,
      "-metadata",
      `com.apple.quicktime.content.identifier=${contentId}`,
      outputNameMov
    ]);

    const movData = await ffmpeg.readFile(outputNameMov);
    const movBytes = typeof movData === "string" ? new TextEncoder().encode(movData) : movData;
    const photoWithXmp = injectXmpPacket(await blobToBytes(photo), buildAppleLivePhotoXmp(contentId));
    const livePhoto = new File([bytesToArrayBuffer(photoWithXmp)], `${outputName}.jpg`, { type: "image/jpeg" });
    const liveVideo = new File([bytesToArrayBuffer(movBytes)], `${outputName}.mov`, { type: "video/quicktime" });

    return {
      contentId,
      photo: livePhoto,
      video: liveVideo
    };
  } finally {
    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputNameMov)
    ]);
  }
}

function buildVideoArgs(settings: OutputSettings): string[] {
  if (settings.videoCodec === "auto" && !settings.maxWidth && !settings.maxHeight) {
    return ["-c", "copy"];
  }

  const args = ["-map", "0:v:0?", "-map", "0:a:0?"];
  const scale = buildScaleFilter(settings);
  if (scale) {
    args.push("-vf", scale);
  }

  args.push("-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k");
  return args;
}

function buildScaleFilter(settings: OutputSettings): string | null {
  if (!settings.maxWidth && !settings.maxHeight) {
    return null;
  }

  const maxWidth = settings.maxWidth ?? 99999;
  const maxHeight = settings.maxHeight ?? 99999;
  return `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;
}
