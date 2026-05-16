import type { LivePhotoFiles } from "./types";

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadIosPair(files: LivePhotoFiles): void {
  downloadBlob(files.photo, files.photo.name);
  window.setTimeout(() => downloadBlob(files.video, files.video.name), 1_000);
}

export function canShareFiles(files: File[]): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };

  return typeof navigator.share === "function" && (typeof nav.canShare !== "function" || nav.canShare({ files }));
}

export async function shareIosPair(files: LivePhotoFiles): Promise<void> {
  const shareFiles = [
    new File([files.photo], files.photo.name, { type: "image/jpeg" }),
    new File([files.video], files.video.name, { type: "video/quicktime" })
  ];

  if (!canShareFiles(shareFiles)) {
    throw new Error("当前环境不支持 Web Share 文件分享。");
  }

  await navigator.share({
    files: shareFiles,
    title: "Live Photo"
  });
}
