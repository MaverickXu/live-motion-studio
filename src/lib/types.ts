export type SourceMode = "pair" | "video" | "url" | "convert";

export type OutputKind = "ios" | "android";

export type ProcessingEngine = "client-wasm" | "server-api" | "client-js";

export type RouteMode = "auto" | "client" | "server";

export type ResolutionPreset = "source" | "long-1920" | "long-1280" | "custom";

export type VideoCodecMode = "auto" | "h264";

export interface OutputSettings {
  resolutionPreset: ResolutionPreset;
  maxWidth?: number;
  maxHeight?: number;
  videoCodec: VideoCodecMode;
  jpegQuality: number;
}

export type StatusKind = "idle" | "busy" | "ready" | "error";

export interface StatusState {
  kind: StatusKind;
  message: string;
}

export interface SourceBundle {
  photo: File;
  video: File;
  sourceName: string;
}

export interface LivePhotoFiles {
  contentId: string;
  photo: File;
  video: File;
}

export interface AndroidMotionResult {
  contentId: string;
  file: File;
}

export interface UrlSourceRequest {
  url: string;
  frameTimeSeconds: number;
  contentId?: string;
  resolutionPreset?: ResolutionPreset;
  maxWidth?: number;
  maxHeight?: number;
  videoCodec?: VideoCodecMode;
  jpegQuality?: number;
}
