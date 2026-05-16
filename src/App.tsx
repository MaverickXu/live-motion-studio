import {
  BookOpen,
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  Film,
  Image as ImageIcon,
  Languages,
  Link,
  Loader2,
  Monitor,
  Moon,
  Network,
  Play,
  RotateCcw,
  Server,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Upload,
  Video,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { convertIosFromFiles, convertIosFromUrl, resolveFileSource, resolveUrlSource } from "./lib/api";
import { canUseClientWasm, chooseIosEngine } from "./lib/capabilities";
import { downloadBlob, downloadIosPair, shareIosPair } from "./lib/download";
import { makeContentId, safeBaseName } from "./lib/ids";
import { extractVideoFrame, normalizeImageToJpeg, outputSettingsNeedVideoTranscode, outputSettingsToMediaOptions } from "./lib/media";
import { makeIosLivePhotoClient } from "./lib/client-live-photo";
import { makeAndroidMotionPhoto, splitAndroidMotionPhoto } from "./lib/motion-photo";
import type {
  AndroidMotionResult,
  LivePhotoFiles,
  OutputKind,
  OutputSettings,
  ResolutionPreset,
  RouteMode,
  SourceBundle,
  SourceMode,
  StatusState,
  VideoCodecMode
} from "./lib/types";

type Language = "zh" | "en";
type ThemeMode = "dark" | "light";

const LOCALES = {
  zh: {
    appSubtitle: "实况照片转换工具",
    languageLabel: "中文",
    themeDark: "深色",
    themeLight: "浅色",
    status: "状态",
    setup: "设置",
    material: "素材",
    export: "导出",
    introTitle: "把普通视频变成相册可识别的实况照片",
    introText: "支持本地素材、视频截帧和 URL 取流；桌面端优先浏览器处理，移动端自动走后端。",
    tutorialTitle: "使用教程",
    stepOne: "选择输入素材",
    stepTwo: "预览封面并设定规格",
    stepThree: "转换后保存到相册",
    input: "输入",
    output: "输出",
    route: "链路",
    specs: "规格",
    preview: "预览",
    paste: "粘贴",
    clear: "清除",
    reset: "重置",
    clickOrDrop: "点击选择或拖拽到这里",
    replaceFile: "点击替换",
    pasteFailed: "无法读取剪贴板，请手动粘贴。",
    materialCleared: "素材已清空",
    preferencesSaved: "偏好会自动保存",
    outputFiles: "输出文件",
    totalSize: "总大小",
    currentRoute: "当前链路",
    adaptive: "自适应",
    pinned: "固定",
    imageVideo: "图片视频",
    videoFrame: "视频截帧",
    url: "URL",
    convertLivePhoto: "实况互转",
    advancedSettings: "进阶设置",
    basicSettings: "收起进阶",
    deviceAutoOutput: "已根据当前设备自动预选输出格式",
    androidWindows: "Android/Windows",
    androidMotionPhoto: "Android / Windows 动态照片",
    iosLivePhotoImage: "iOS 实况照片 JPG",
    iosLivePhotoVideo: "iOS 实况照片 MOV",
    auto: "自动",
    browser: "浏览器",
    backend: "后端",
    coverImage: "封面图片",
    motionVideo: "动态视频",
    videoUrl: "视频直链",
    urlPlaceholder: "https://example.com/video.mp4",
    frameTime: "封面时间",
    seconds: "秒",
    noFile: "未选择",
    previewEmpty: "选择视频后自动预览封面",
    previewLoading: "正在生成预览",
    previewError: "预览生成失败",
    resolution: "分辨率",
    sourceResolution: "原始",
    long1920: "长边 1920",
    long1280: "长边 1280",
    custom: "自定义",
    width: "宽",
    height: "高",
    codec: "编码",
    codecAuto: "自动",
    codecH264: "H.264",
    quality: "JPEG 质量",
    resultEmpty: "等待输出",
    start: "开始转换",
    save: "保存",
    download: "下载",
    modalTitle: "实况照片已就绪",
    modalText: "点击保存，系统会重新打开原生分享面板。",
    statusWaiting: "等待素材",
    statusIncomplete: "素材不完整",
    statusPreparing: "准备素材",
    statusAndroidMeta: "写入 Android Motion Photo 元数据",
    statusAndroidReady: "Android Motion Photo 已生成",
    statusServerUrlIos: "后端解析并封装远程视频",
    statusResolvingUrl: "解析远程视频",
    statusDesktopWasm: "桌面端 WASM 写入 MOV 元数据",
    statusFallbackServer: "切换后端完成 iOS 封装",
    statusWasmFallback: "WASM 不可用，切换后端处理",
    statusServerMeta: "后端写入 iOS Live Photo 元数据",
    statusFrame: "截取封面帧",
    statusServerFetch: "后端取回 URL 视频",
    statusBrowserFetch: "浏览器读取 URL 视频",
    statusServerSource: "后端处理素材规格",
    statusShareOpen: "唤起系统保存面板",
    statusShareDone: "Live Photo 已交给系统保存",
    statusLiveReady: "Live Photo 已就绪",
    statusDownloadFallback: "分享不可用，已降级下载 JPG 和 MOV",
    statusDownloadedPair: "已降级下载 JPG 和 MOV",
    conversionFailed: "转换失败",
    choosePair: "请同时选择图片和视频。",
    chooseVideo: "请选择一个视频。",
    chooseMotionPhoto: "请上传 Android / Windows 动态照片 JPG。",
    chooseLivePair: "请同时上传 iOS 实况照片的 JPG 和 MOV。",
    statusParsingMotion: "正在拆解动态照片",
    motionPhotoParseFailed: "没有在这个 JPG 中找到动态照片视频，请确认它是 Android / Windows Motion Photo。",
    wasmUnsupported: "当前浏览器不支持前端 WASM 链路，请切换到后端或自动。",
    hlsNeedsServer: "m3u8 需要后端链路解析，请切换到后端或自动。",
    browserUrlBlocked: "浏览器无法直接读取这个 URL，常见原因是跨域限制，请切换到后端链路。",
    browserUrlHttp: "浏览器读取 URL 失败：HTTP {status}",
    browserUrlEmpty: "URL 没有返回可用的视频内容。",
    routeAndroidUrlClient: "浏览器直取 URL + 前端合成",
    routeAndroidUrlServer: "后端取流 + 前端合成",
    routeAndroidLocal: "浏览器合成",
    routeIosClient: "强制浏览器 WASM",
    routeIosServer: "强制后端 API",
    routeIosUrlClient: "后端解析 URL + 桌面端 WASM",
    routeIosUrlServer: "后端解析 URL",
    routeIosLocalClient: "桌面端 WASM",
    routeIosLocalServer: "移动端后端"
  },
  en: {
    appSubtitle: "Live Photo conversion studio",
    languageLabel: "English",
    themeDark: "Dark",
    themeLight: "Light",
    status: "Status",
    setup: "Setup",
    material: "Source",
    export: "Export",
    introTitle: "Turn ordinary videos into gallery-ready Live Photos",
    introText: "Use local files, captured video frames, or URL sources. Desktop prefers browser processing; mobile falls back to the server.",
    tutorialTitle: "Guide",
    stepOne: "Choose source media",
    stepTwo: "Preview cover and set output specs",
    stepThree: "Convert and save to Photos",
    input: "Input",
    output: "Output",
    route: "Route",
    specs: "Specs",
    preview: "Preview",
    paste: "Paste",
    clear: "Clear",
    reset: "Reset",
    clickOrDrop: "Click or drop files here",
    replaceFile: "Click to replace",
    pasteFailed: "Clipboard is unavailable. Paste manually.",
    materialCleared: "Sources cleared",
    preferencesSaved: "Preferences are saved automatically",
    outputFiles: "Output files",
    totalSize: "Total size",
    currentRoute: "Active route",
    adaptive: "Adaptive",
    pinned: "Pinned",
    imageVideo: "Image+Video",
    videoFrame: "Video Frame",
    url: "URL",
    convertLivePhoto: "Live Convert",
    advancedSettings: "Advanced settings",
    basicSettings: "Hide advanced",
    deviceAutoOutput: "Output was preselected for this device",
    androidWindows: "Android/Windows",
    androidMotionPhoto: "Android / Windows Motion Photo",
    iosLivePhotoImage: "iOS Live Photo JPG",
    iosLivePhotoVideo: "iOS Live Photo MOV",
    auto: "Auto",
    browser: "Browser",
    backend: "Server",
    coverImage: "Cover image",
    motionVideo: "Motion video",
    videoUrl: "Video URL",
    urlPlaceholder: "https://example.com/video.mp4",
    frameTime: "Cover time",
    seconds: "sec",
    noFile: "No file selected",
    previewEmpty: "Choose a video to preview the cover",
    previewLoading: "Generating preview",
    previewError: "Preview failed",
    resolution: "Resolution",
    sourceResolution: "Original",
    long1920: "Long edge 1920",
    long1280: "Long edge 1280",
    custom: "Custom",
    width: "Width",
    height: "Height",
    codec: "Codec",
    codecAuto: "Auto",
    codecH264: "H.264",
    quality: "JPEG quality",
    resultEmpty: "Waiting for output",
    start: "Convert",
    save: "Save",
    download: "Download",
    modalTitle: "Live Photo is ready",
    modalText: "Click save to reopen the native share sheet.",
    statusWaiting: "Waiting for source",
    statusIncomplete: "Source is incomplete",
    statusPreparing: "Preparing source",
    statusAndroidMeta: "Writing Android Motion Photo metadata",
    statusAndroidReady: "Android Motion Photo is ready",
    statusServerUrlIos: "Resolving and packaging remote video",
    statusResolvingUrl: "Resolving remote video",
    statusDesktopWasm: "Writing MOV metadata in desktop WASM",
    statusFallbackServer: "Switching to server packaging",
    statusWasmFallback: "WASM unavailable, switching to server",
    statusServerMeta: "Writing iOS Live Photo metadata on server",
    statusFrame: "Capturing cover frame",
    statusServerFetch: "Fetching URL on server",
    statusBrowserFetch: "Fetching URL in browser",
    statusServerSource: "Processing source specs on server",
    statusShareOpen: "Opening system save sheet",
    statusShareDone: "Live Photo sent to the system",
    statusLiveReady: "Live Photo is ready",
    statusDownloadFallback: "Share unavailable, downloaded JPG and MOV",
    statusDownloadedPair: "Downloaded JPG and MOV",
    conversionFailed: "Conversion failed",
    choosePair: "Choose both an image and a video.",
    chooseVideo: "Choose a video.",
    chooseMotionPhoto: "Choose an Android / Windows Motion Photo JPG.",
    chooseLivePair: "Choose both the iOS Live Photo JPG and MOV.",
    statusParsingMotion: "Splitting Motion Photo",
    motionPhotoParseFailed: "No motion video was found in this JPG. Make sure it is an Android / Windows Motion Photo.",
    wasmUnsupported: "This browser does not support the WASM route. Switch to server or auto.",
    hlsNeedsServer: "m3u8 needs the server route. Switch to server or auto.",
    browserUrlBlocked: "The browser cannot read this URL directly, usually because of CORS. Switch to the server route.",
    browserUrlHttp: "Browser URL fetch failed: HTTP {status}",
    browserUrlEmpty: "The URL did not return usable video content.",
    routeAndroidUrlClient: "Browser URL + client compose",
    routeAndroidUrlServer: "Server fetch + client compose",
    routeAndroidLocal: "Browser compose",
    routeIosClient: "Pinned browser WASM",
    routeIosServer: "Pinned server API",
    routeIosUrlClient: "Server URL + desktop WASM",
    routeIosUrlServer: "Server URL",
    routeIosLocalClient: "Desktop WASM",
    routeIosLocalServer: "Mobile server"
  }
} as const;

type Copy = { readonly [K in keyof typeof LOCALES.zh]: string };

export default function App() {
  const [language, setLanguage] = useState<Language>(readStoredLanguage);
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);
  const copy: Copy = LOCALES[language];

  const [sourceMode, setSourceMode] = useState<SourceMode>(() => readStoredOption("live-motion-source", "pair", ["pair", "video", "url", "convert"]));
  const [outputKind, setOutputKind] = useState<OutputKind>(detectOutputKindFromUa);
  const [routeMode, setRouteMode] = useState<RouteMode>(() => readStoredOption("live-motion-route", "auto", ["auto", "client", "server"]));
  const [resolutionPreset, setResolutionPreset] = useState<ResolutionPreset>(() =>
    readStoredOption("live-motion-resolution", "source", ["source", "long-1920", "long-1280", "custom"])
  );
  const [customWidth, setCustomWidth] = useState(() => readStoredNumber("live-motion-custom-width", 1080, 160, 4096));
  const [customHeight, setCustomHeight] = useState(() => readStoredNumber("live-motion-custom-height", 1920, 160, 4096));
  const [videoCodec, setVideoCodec] = useState<VideoCodecMode>(() => readStoredOption("live-motion-codec", "auto", ["auto", "h264"]));
  const [jpegQuality, setJpegQuality] = useState(() => readStoredNumber("live-motion-jpeg-quality", 94, 60, 98));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [motionPhotoFile, setMotionPhotoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [frameTime, setFrameTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [status, setStatus] = useState<StatusState>(() => ({ kind: "idle", message: copy.statusWaiting }));
  const [iosResult, setIosResult] = useState<LivePhotoFiles | null>(null);
  const [androidResult, setAndroidResult] = useState<AndroidMotionResult | null>(null);
  const [pendingShare, setPendingShare] = useState<LivePhotoFiles | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("live-motion-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    localStorage.setItem("live-motion-language", language);
    setStatus((current) => current.kind === "idle" ? { kind: "idle", message: LOCALES[language].statusWaiting } : current);
  }, [language]);

  useEffect(() => {
    localStorage.setItem("live-motion-source", sourceMode);
    localStorage.setItem("live-motion-output", outputKind);
    localStorage.setItem("live-motion-route", routeMode);
    localStorage.setItem("live-motion-resolution", resolutionPreset);
    localStorage.setItem("live-motion-custom-width", String(customWidth));
    localStorage.setItem("live-motion-custom-height", String(customHeight));
    localStorage.setItem("live-motion-codec", videoCodec);
    localStorage.setItem("live-motion-jpeg-quality", String(jpegQuality));
  }, [customHeight, customWidth, jpegQuality, outputKind, resolutionPreset, routeMode, sourceMode, videoCodec]);

  const outputSettings = useMemo(
    () => makeOutputSettings(resolutionPreset, customWidth, customHeight, videoCodec, jpegQuality),
    [customHeight, customWidth, jpegQuality, resolutionPreset, videoCodec]
  );

  const mediaOptions = useMemo(() => outputSettingsToMediaOptions(outputSettings), [outputSettings]);

  useEffect(() => {
    setIosResult(null);
    setAndroidResult(null);
    setPendingShare(null);
  }, [frameTime, imageFile, motionPhotoFile, outputKind, outputSettings, sourceMode, videoFile, videoUrl]);

  useEffect(() => {
    if (!videoFile || sourceMode !== "video") {
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return "";
      });
      setPreviewStatus("idle");
      return;
    }

    let cancelled = false;
    let objectUrl = "";
    const timer = window.setTimeout(async () => {
      setPreviewStatus("loading");
      try {
        const frame = await extractVideoFrame(videoFile, frameTime, mediaOptions);
        objectUrl = URL.createObjectURL(frame);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return objectUrl;
        });
        setPreviewStatus("ready");
      } catch {
        if (!cancelled) {
          setPreviewUrl((current) => {
            if (current) {
              URL.revokeObjectURL(current);
            }
            return "";
          });
          setPreviewStatus("error");
        }
      }
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [frameTime, mediaOptions, sourceMode, videoFile]);

  const routeLabel = useMemo(
    () => getRouteLabel(outputKind, sourceMode, routeMode, copy),
    [copy, outputKind, routeMode, sourceMode]
  );

  const canSubmit = useMemo(() => {
    if (status.kind === "busy") {
      return false;
    }
    if (sourceMode === "pair") {
      return Boolean(imageFile && videoFile);
    }
    if (sourceMode === "video") {
      return Boolean(videoFile);
    }
    if (sourceMode === "convert") {
      return outputKind === "ios" ? Boolean(motionPhotoFile) : Boolean(imageFile && videoFile);
    }

    return videoUrl.trim().length > 0;
  }, [imageFile, motionPhotoFile, outputKind, sourceMode, status.kind, videoFile, videoUrl]);

  async function handleConvert() {
    if (!canSubmit) {
      setStatus({ kind: "error", message: copy.statusIncomplete });
      return;
    }

    const contentId = makeContentId();
    const outputName = getOutputName();
    setIosResult(null);
    setAndroidResult(null);
    setStatus({ kind: "busy", message: copy.statusPreparing });

    try {
      if (outputKind === "android") {
        const source = await getSourceBundle(contentId, outputName);
        setStatus({ kind: "busy", message: copy.statusAndroidMeta });
        const result = await makeAndroidMotionPhoto(source.photo, source.video, contentId, outputName, frameTime * 1_000_000);
        setAndroidResult(result);
        downloadBlob(result.file, result.file.name);
        setStatus({ kind: "ready", message: copy.statusAndroidReady });
        return;
      }

      const livePhoto = await buildIosLivePhoto(contentId, outputName);
      setIosResult(livePhoto);
      await deliverIosLivePhoto(livePhoto);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : copy.conversionFailed
      });
    }
  }

  async function buildIosLivePhoto(contentId: string, outputName: string): Promise<LivePhotoFiles> {
    if (sourceMode === "url") {
      if (routeMode === "server") {
        setStatus({ kind: "busy", message: copy.statusServerUrlIos });
        return convertIosFromUrl(withOutputSettings({ url: videoUrl.trim(), frameTimeSeconds: frameTime, contentId }, outputSettings), outputName);
      }

      if (routeMode === "client" && !canUseClientWasm()) {
        throw new Error(copy.wasmUnsupported);
      }

      if (routeMode === "client" || chooseIosEngine() === "client-wasm") {
        try {
          const source = await getUrlSourceBundle(contentId, outputName, "browser");
          setStatus({ kind: "busy", message: copy.statusDesktopWasm });
          return await makeIosLivePhotoClient(source.photo, source.video, contentId, outputName, outputSettings);
        } catch (error) {
          if (routeMode === "client") {
            throw error;
          }
          console.warn("URL WASM route failed, falling back to server API.", error);
          setStatus({ kind: "busy", message: copy.statusFallbackServer });
        }
      }

      setStatus({ kind: "busy", message: copy.statusResolvingUrl });
      return convertIosFromUrl(withOutputSettings({ url: videoUrl.trim(), frameTimeSeconds: frameTime, contentId }, outputSettings), outputName);
    }

    const source = await getSourceBundle(contentId, outputName);
    const engine = routeMode === "server" ? "server-api" : routeMode === "client" ? "client-wasm" : chooseIosEngine();

    if (routeMode === "client" && !canUseClientWasm()) {
      throw new Error(copy.wasmUnsupported);
    }

    if (engine === "client-wasm") {
      try {
        setStatus({ kind: "busy", message: copy.statusDesktopWasm });
        return await makeIosLivePhotoClient(source.photo, source.video, contentId, outputName, outputSettings);
      } catch (error) {
        if (routeMode === "client") {
          throw error;
        }
        console.warn("WASM route failed, falling back to server API.", error);
        setStatus({ kind: "busy", message: copy.statusWasmFallback });
      }
    }

    setStatus({ kind: "busy", message: copy.statusServerMeta });
    return convertIosFromFiles(source.photo, source.video, contentId, outputName, outputSettings);
  }

  async function getSourceBundle(contentId: string, outputName: string): Promise<SourceBundle> {
    if (sourceMode === "url") {
      return getUrlSourceBundle(contentId, outputName, routeMode === "client" ? "browser" : "server");
    }

    if (sourceMode === "convert") {
      if (outputKind === "ios") {
        if (!motionPhotoFile) {
          throw new Error(copy.chooseMotionPhoto);
        }

        setStatus({ kind: "busy", message: copy.statusParsingMotion });
        try {
          return await splitAndroidMotionPhoto(motionPhotoFile, outputName);
        } catch {
          throw new Error(copy.motionPhotoParseFailed);
        }
      }

      if (!imageFile || !videoFile) {
        throw new Error(copy.chooseLivePair);
      }

      if (outputSettingsNeedVideoTranscode(outputSettings) && routeMode !== "client") {
        setStatus({ kind: "busy", message: copy.statusServerSource });
        return resolveFileSource(imageFile, videoFile, frameTime, contentId, outputName, outputSettings);
      }

      return {
        photo: await normalizeImageToJpeg(imageFile, mediaOptions),
        video: videoFile,
        sourceName: outputName
      };
    }

    if (outputKind === "android" && outputSettingsNeedVideoTranscode(outputSettings) && routeMode !== "client") {
      if (sourceMode === "pair" && (!imageFile || !videoFile)) {
        throw new Error(copy.choosePair);
      }
      setStatus({ kind: "busy", message: copy.statusServerSource });
      return resolveFileSource(
        sourceMode === "pair" ? imageFile : null,
        requireVideo(videoFile, copy.chooseVideo),
        frameTime,
        contentId,
        outputName,
        outputSettings
      );
    }

    if (sourceMode === "pair") {
      if (!imageFile || !videoFile) {
        throw new Error(copy.choosePair);
      }

      return {
        photo: await normalizeImageToJpeg(imageFile, mediaOptions),
        video: videoFile,
        sourceName: outputName
      };
    }

    if (!videoFile) {
      throw new Error(copy.chooseVideo);
    }

    setStatus({ kind: "busy", message: copy.statusFrame });
    return {
      photo: await extractVideoFrame(videoFile, frameTime, mediaOptions),
      video: videoFile,
      sourceName: outputName
    };
  }

  async function getUrlSourceBundle(contentId: string, outputName: string, route: "browser" | "server"): Promise<SourceBundle> {
    const url = videoUrl.trim();

    if (route === "server") {
      setStatus({ kind: "busy", message: copy.statusServerFetch });
      return resolveUrlSource(withOutputSettings({ url, frameTimeSeconds: frameTime, contentId }, outputSettings), outputName);
    }

    if (isHlsUrl(url)) {
      throw new Error(copy.hlsNeedsServer);
    }

    setStatus({ kind: "busy", message: copy.statusBrowserFetch });

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new Error(copy.browserUrlBlocked);
    }

    if (!response.ok) {
      throw new Error(copy.browserUrlHttp.replace("{status}", String(response.status)));
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error(copy.browserUrlEmpty);
    }

    const fileType = contentType.toLowerCase().startsWith("video/") ? contentType : "video/mp4";
    const video = new File([blob], `${outputName}.${guessVideoExtension(url, fileType)}`, { type: fileType });

    setStatus({ kind: "busy", message: copy.statusFrame });
    return {
      photo: await extractVideoFrame(video, frameTime, mediaOptions),
      video,
      sourceName: outputName
    };
  }

  async function deliverIosLivePhoto(files: LivePhotoFiles) {
    setStatus({ kind: "busy", message: copy.statusShareOpen });

    try {
      await shareIosPair(files);
      setStatus({ kind: "ready", message: copy.statusShareDone });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setPendingShare(files);
        setStatus({ kind: "ready", message: copy.statusLiveReady });
        return;
      }

      downloadIosPair(files);
      setStatus({ kind: "ready", message: copy.statusDownloadFallback });
    }
  }

  async function handleModalShare() {
    if (!pendingShare) {
      return;
    }

    try {
      await shareIosPair(pendingShare);
      setPendingShare(null);
      setStatus({ kind: "ready", message: copy.statusShareDone });
    } catch {
      downloadIosPair(pendingShare);
      setPendingShare(null);
      setStatus({ kind: "ready", message: copy.statusDownloadedPair });
    }
  }

  async function handlePasteUrl() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setVideoUrl(text.trim());
      }
    } catch {
      setStatus({ kind: "error", message: copy.pasteFailed });
    }
  }

  function handleClearSources() {
    setImageFile(null);
    setVideoFile(null);
    setMotionPhotoFile(null);
    setVideoUrl("");
    setFrameTime(0);
    setIosResult(null);
    setAndroidResult(null);
    setPendingShare(null);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return "";
    });
    setPreviewStatus("idle");
    setStatus({ kind: "idle", message: copy.materialCleared });
  }

  function handleResetPreferences() {
    setSourceMode("pair");
    setOutputKind(detectOutputKindFromUa());
    setRouteMode("auto");
    setResolutionPreset("source");
    setCustomWidth(1080);
    setCustomHeight(1920);
    setVideoCodec("auto");
    setJpegQuality(94);
    setAdvancedOpen(false);
    setStatus({ kind: "idle", message: copy.preferencesSaved });
  }

  function getOutputName(): string {
    if (sourceMode === "url") {
      try {
        const pathname = new URL(videoUrl.trim()).pathname;
        return safeBaseName(pathname.split("/").pop() || "remote-video");
      } catch {
        return "remote-video";
      }
    }

    if (sourceMode === "convert" && motionPhotoFile) {
      return safeBaseName(motionPhotoFile.name);
    }

    return safeBaseName(videoFile?.name || imageFile?.name || "live-photo");
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">LM</span>
          <div>
            <h1>Live Motion Studio</h1>
            <p>{copy.appSubtitle}</p>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            aria-label={copy.languageLabel}
          >
            <Languages size={16} />
            <span>{copy.languageLabel}</span>
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? copy.themeDark : copy.themeLight}
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === "dark" ? copy.themeDark : copy.themeLight}</span>
          </button>
        </div>
      </header>

      <section className="status-strip">
        <div className="status-readout">
          <span className={`status-dot ${status.kind}`} />
          <span className="muted-label">{copy.status}</span>
          <strong>{status.message}</strong>
        </div>
        <div className="route-readout">
          <span>{copy.currentRoute}</span>
          <strong>{routeLabel}</strong>
        </div>
      </section>

      <section className="intro-band">
        <div className="intro-copy">
          <span>Live Motion Studio</span>
          <h2>{copy.introTitle}</h2>
          <p>{copy.introText}</p>
        </div>
        <div className="guide-card">
          <div className="guide-title">
            <BookOpen size={16} />
            <strong>{copy.tutorialTitle}</strong>
          </div>
          <ol>
            <li>{copy.stepOne}</li>
            <li>{copy.stepTwo}</li>
            <li>{copy.stepThree}</li>
          </ol>
        </div>
      </section>

      <section className="studio-grid">
        <section className="panel setup-panel">
          <PanelHeading eyebrow="01" title={copy.setup} icon={<Network size={17} />} />

          <ControlGroup label={copy.input}>
            <SegmentedControl
              value={sourceMode}
              onChange={setSourceMode}
              items={[
                { value: "pair", label: copy.imageVideo, icon: <ImageIcon size={16} /> },
                { value: "video", label: copy.videoFrame, icon: <Video size={16} /> },
                { value: "url", label: copy.url, icon: <Link size={16} /> },
                { value: "convert", label: copy.convertLivePhoto, icon: <RotateCcw size={16} /> }
              ]}
            />
          </ControlGroup>

          <ControlGroup label={copy.output}>
            <SegmentedControl
              value={outputKind}
              onChange={setOutputKind}
              items={[
                { value: "ios", label: "iOS", icon: <Smartphone size={16} /> },
                { value: "android", label: copy.androidWindows, icon: <Monitor size={16} /> }
              ]}
            />
            <small className="field-hint">{copy.deviceAutoOutput}</small>
          </ControlGroup>

          <button className="advanced-toggle" type="button" onClick={() => setAdvancedOpen((current) => !current)}>
            <SlidersHorizontal size={16} />
            <span>{advancedOpen ? copy.basicSettings : copy.advancedSettings}</span>
          </button>

          {advancedOpen && (
            <div className="advanced-panel">
              <ControlGroup label={copy.route}>
                <SegmentedControl
                  value={routeMode}
                  onChange={setRouteMode}
                  items={[
                    { value: "auto", label: copy.auto, icon: <Network size={16} /> },
                    { value: "client", label: copy.browser, icon: <Monitor size={16} /> },
                    { value: "server", label: copy.backend, icon: <Server size={16} /> }
                  ]}
                />
              </ControlGroup>

              <ControlGroup label={copy.specs}>
                <SegmentedControl
                  value={resolutionPreset}
                  onChange={setResolutionPreset}
                  items={[
                    { value: "source", label: copy.sourceResolution, icon: <Film size={16} /> },
                    { value: "long-1920", label: "1920", icon: <SlidersHorizontal size={16} /> },
                    { value: "long-1280", label: "1280", icon: <SlidersHorizontal size={16} /> },
                    { value: "custom", label: copy.custom, icon: <SlidersHorizontal size={16} /> }
                  ]}
                />
                {resolutionPreset === "custom" && (
                  <div className="spec-grid">
                    <NumberField label={copy.width} value={customWidth} min={160} max={4096} setValue={setCustomWidth} />
                    <NumberField label={copy.height} value={customHeight} min={160} max={4096} setValue={setCustomHeight} />
                  </div>
                )}
                <SegmentedControl
                  value={videoCodec}
                  onChange={setVideoCodec}
                  items={[
                    { value: "auto", label: copy.codecAuto, icon: <Network size={16} /> },
                    { value: "h264", label: copy.codecH264, icon: <Film size={16} /> }
                  ]}
                />
                <label className="quality-field">
                  <span>{copy.quality}</span>
                  <input
                    type="range"
                    min="60"
                    max="98"
                    value={jpegQuality}
                    onChange={(event) => setJpegQuality(Number(event.target.value))}
                  />
                  <strong>{jpegQuality}</strong>
                </label>
              </ControlGroup>

              <div className="route-card">
                <span>{routeMode === "auto" ? copy.adaptive : copy.pinned}</span>
                <strong>{routeLabel}</strong>
                <small>{copy.preferencesSaved}</small>
                <button className="text-button" type="button" onClick={handleResetPreferences}>
                  <RotateCcw size={15} />
                  <span>{copy.reset}</span>
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="panel source-panel">
          <PanelHeading eyebrow="02" title={copy.material} icon={<Upload size={17} />} />
          <div className="panel-action-row">
            <button className="text-button" type="button" onClick={handleClearSources}>
              <X size={15} />
              <span>{copy.clear}</span>
            </button>
          </div>

          {sourceMode === "pair" && (
            <div className="input-stack">
              <FilePicker
                label={copy.coverImage}
                accept="image/*"
                file={imageFile}
                emptyLabel={copy.noFile}
                helper={copy.clickOrDrop}
                selectedHelper={copy.replaceFile}
                onChange={setImageFile}
                icon={<ImageIcon size={18} />}
              />
              <FilePicker
                label={copy.motionVideo}
                accept="video/*"
                file={videoFile}
                emptyLabel={copy.noFile}
                helper={copy.clickOrDrop}
                selectedHelper={copy.replaceFile}
                onChange={setVideoFile}
                icon={<Video size={18} />}
              />
            </div>
          )}

          {sourceMode === "video" && (
            <div className="input-stack">
              <FilePicker
                label={copy.motionVideo}
                accept="video/*"
                file={videoFile}
                emptyLabel={copy.noFile}
                helper={copy.clickOrDrop}
                selectedHelper={copy.replaceFile}
                onChange={setVideoFile}
                icon={<Video size={18} />}
              />
              <FrameInput copy={copy} frameTime={frameTime} setFrameTime={setFrameTime} />
            </div>
          )}

          {sourceMode === "url" && (
            <div className="input-stack">
              <label className="url-field">
                <span>{copy.videoUrl}</span>
                <div className="url-input-row">
                  <input
                    type="url"
                    value={videoUrl}
                    placeholder={copy.urlPlaceholder}
                    onChange={(event) => setVideoUrl(event.target.value)}
                  />
                  <button className="secondary-button compact" type="button" onClick={handlePasteUrl}>
                    <Clipboard size={15} />
                    <span>{copy.paste}</span>
                  </button>
                </div>
              </label>
              <FrameInput copy={copy} frameTime={frameTime} setFrameTime={setFrameTime} />
            </div>
          )}

          {sourceMode === "convert" && outputKind === "ios" && (
            <div className="input-stack">
              <FilePicker
                label={copy.androidMotionPhoto}
                accept="image/*,.jpg,.jpeg,.mp.jpg"
                file={motionPhotoFile}
                emptyLabel={copy.noFile}
                helper={copy.clickOrDrop}
                selectedHelper={copy.replaceFile}
                onChange={setMotionPhotoFile}
                icon={<ImageIcon size={18} />}
              />
            </div>
          )}

          {sourceMode === "convert" && outputKind === "android" && (
            <div className="input-stack">
              <FilePicker
                label={copy.iosLivePhotoImage}
                accept="image/*"
                file={imageFile}
                emptyLabel={copy.noFile}
                helper={copy.clickOrDrop}
                selectedHelper={copy.replaceFile}
                onChange={setImageFile}
                icon={<ImageIcon size={18} />}
              />
              <FilePicker
                label={copy.iosLivePhotoVideo}
                accept="video/*,.mov"
                file={videoFile}
                emptyLabel={copy.noFile}
                helper={copy.clickOrDrop}
                selectedHelper={copy.replaceFile}
                onChange={setVideoFile}
                icon={<Video size={18} />}
              />
            </div>
          )}

          <PreviewPane
            copy={copy}
            sourceMode={sourceMode}
            coverFile={sourceMode === "convert" && outputKind === "ios" ? motionPhotoFile : imageFile}
            previewUrl={previewUrl}
            previewStatus={previewStatus}
          />
        </section>

        <section className="panel result-panel">
          <PanelHeading eyebrow="03" title={copy.export} icon={<CheckCircle2 size={17} />} />

          <ResultView
            copy={copy}
            outputKind={outputKind}
            iosResult={iosResult}
            androidResult={androidResult}
            onShare={() => iosResult && deliverIosLivePhoto(iosResult)}
            onDownload={() => {
              if (iosResult) {
                downloadIosPair(iosResult);
              }
              if (androidResult) {
                downloadBlob(androidResult.file, androidResult.file.name);
              }
            }}
          />

          <button className="primary-button" type="button" disabled={!canSubmit} onClick={handleConvert}>
            {status.kind === "busy" ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
            <span>{copy.start}</span>
          </button>
        </section>
      </section>

      {pendingShare && (
        <div className="modal-backdrop" role="presentation">
          <div className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <h2 id="share-title">{copy.modalTitle}</h2>
            <p>{copy.modalText}</p>
            <button type="button" className="primary-button wide" onClick={handleModalShare}>
              <Share2 size={18} />
              <span>{copy.save}</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

interface SegmentItem<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

function PanelHeading({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: ReactNode }) {
  return (
    <div className="panel-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {icon}
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="control-group">
      <span className="group-label">{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  items
}: {
  value: T;
  onChange: (value: T) => void;
  items: SegmentItem<T>[];
}) {
  return (
    <div
      className={`segmented ${items.length > 3 ? "dense" : ""}`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={value === item.value ? "active" : ""}
          onClick={() => onChange(item.value)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function FilePicker({
  label,
  accept,
  file,
  emptyLabel,
  helper,
  selectedHelper,
  icon,
  onChange
}: {
  label: string;
  accept: string;
  file: File | null;
  emptyLabel: string;
  helper: string;
  selectedHelper: string;
  icon: ReactNode;
  onChange: (file: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile && matchesAccept(droppedFile, accept)) {
      onChange(droppedFile);
    }
  }

  return (
    <label
      className={`file-picker ${dragging ? "dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={(event) => {
          onChange(event.currentTarget.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
      <span className="file-icon">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{file ? file.name : emptyLabel}</small>
        <em>{file ? selectedHelper : helper}</em>
      </span>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  setValue
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  setValue: (value: number) => void;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step="2"
        value={value}
        onChange={(event) => setValue(clampEven(Number(event.target.value) || min, min, max))}
      />
    </label>
  );
}

function PreviewPane({
  copy,
  sourceMode,
  coverFile,
  previewUrl,
  previewStatus
}: {
  copy: Copy;
  sourceMode: SourceMode;
  coverFile: File | null;
  previewUrl: string;
  previewStatus: "idle" | "loading" | "ready" | "error";
}) {
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  useEffect(() => {
    if (!coverFile || (sourceMode !== "pair" && sourceMode !== "convert")) {
      setImagePreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return "";
      });
      return;
    }

    const objectUrl = URL.createObjectURL(coverFile);
    setImagePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return objectUrl;
    });

    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile, sourceMode]);

  const src = sourceMode === "pair" || sourceMode === "convert" ? imagePreviewUrl : previewUrl;
  const label = previewStatus === "loading" ? copy.previewLoading : previewStatus === "error" ? copy.previewError : copy.previewEmpty;

  return (
    <section className="preview-pane">
      <div className="preview-title">
        <Eye size={16} />
        <span>{copy.preview}</span>
      </div>
      {src ? (
        <img src={src} alt={copy.preview} />
      ) : (
        <div className="preview-empty">
          <Eye size={18} />
          <span>{sourceMode === "video" ? label : copy.previewEmpty}</span>
        </div>
      )}
    </section>
  );
}

function FrameInput({ copy, frameTime, setFrameTime }: { copy: Copy; frameTime: number; setFrameTime: (value: number) => void }) {
  return (
    <label className="frame-field">
      <span>{copy.frameTime}</span>
      <input
        type="number"
        min="0"
        step="0.1"
        value={frameTime}
        onChange={(event) => setFrameTime(Math.max(0, Number(event.target.value) || 0))}
      />
      <small>{copy.seconds}</small>
    </label>
  );
}

function ResultView({
  copy,
  outputKind,
  iosResult,
  androidResult,
  onShare,
  onDownload
}: {
  copy: Copy;
  outputKind: OutputKind;
  iosResult: LivePhotoFiles | null;
  androidResult: AndroidMotionResult | null;
  onShare: () => void;
  onDownload: () => void;
}) {
  const files =
    outputKind === "ios" && iosResult
      ? [
          { name: iosResult.photo.name, detail: "JPEG", size: iosResult.photo.size },
          { name: iosResult.video.name, detail: "MOV", size: iosResult.video.size }
        ]
      : outputKind === "android" && androidResult
        ? [{ name: androidResult.file.name, detail: "Motion JPG", size: androidResult.file.size }]
        : [];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (files.length === 0) {
    return (
      <div className="empty-state">
        <CheckCircle2 size={18} />
        <span>{copy.resultEmpty}</span>
      </div>
    );
  }

  return (
    <div className="result-stack">
      <div className="result-summary">
        <span>{copy.outputFiles}</span>
        <strong>
          {copy.totalSize}: {formatBytes(totalSize)}
        </strong>
      </div>

      {outputKind === "ios" && (
        <>
          {files.map((file) => (
            <FileLine key={`${file.name}-${file.detail}`} name={file.name} detail={file.detail} size={file.size} />
          ))}
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={onShare}>
              <Share2 size={17} />
              <span>{copy.save}</span>
            </button>
            <button type="button" className="secondary-button" onClick={onDownload}>
              <Download size={17} />
              <span>{copy.download}</span>
            </button>
          </div>
        </>
      )}

      {outputKind === "android" && (
        <>
          {files.map((file) => (
            <FileLine key={`${file.name}-${file.detail}`} name={file.name} detail={file.detail} size={file.size} />
          ))}
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={onDownload}>
              <Download size={17} />
              <span>{copy.download}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FileLine({ name, detail, size }: { name: string; detail: string; size: number }) {
  return (
    <div className="file-line">
      <span>
        <span>{name}</span>
        <small>{formatBytes(size)}</small>
      </span>
      <strong>{detail}</strong>
    </div>
  );
}

function getRouteLabel(outputKind: OutputKind, sourceMode: SourceMode, routeMode: RouteMode, copy: Copy): string {
  if (outputKind === "android") {
    if (sourceMode === "url") {
      return routeMode === "client" ? copy.routeAndroidUrlClient : copy.routeAndroidUrlServer;
    }

    return copy.routeAndroidLocal;
  }

  if (routeMode === "client") {
    return copy.routeIosClient;
  }
  if (routeMode === "server") {
    return copy.routeIosServer;
  }
  if (sourceMode === "url") {
    return chooseIosEngine() === "client-wasm" ? copy.routeIosUrlClient : copy.routeIosUrlServer;
  }

  return chooseIosEngine() === "client-wasm" ? copy.routeIosLocalClient : copy.routeIosLocalServer;
}

function isHlsUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return url.toLowerCase().split("?")[0].endsWith(".m3u8");
  }
}

function guessVideoExtension(url: string, contentType: string): string {
  if (contentType.includes("quicktime")) {
    return "mov";
  }
  if (contentType.includes("webm")) {
    return "webm";
  }
  if (contentType.includes("mp4") || contentType.includes("mpeg")) {
    return "mp4";
  }

  try {
    const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
    if (extension && ["mp4", "m4v", "mov", "webm"].includes(extension)) {
      return extension;
    }
  } catch {
    const extension = url.split("?")[0].split(".").pop()?.toLowerCase();
    if (extension && ["mp4", "m4v", "mov", "webm"].includes(extension)) {
      return extension;
    }
  }

  return "mp4";
}

function makeOutputSettings(
  resolutionPreset: ResolutionPreset,
  customWidth: number,
  customHeight: number,
  videoCodec: VideoCodecMode,
  jpegQuality: number
): OutputSettings {
  if (resolutionPreset === "long-1920") {
    return { resolutionPreset, maxWidth: 1920, maxHeight: 1920, videoCodec, jpegQuality };
  }
  if (resolutionPreset === "long-1280") {
    return { resolutionPreset, maxWidth: 1280, maxHeight: 1280, videoCodec, jpegQuality };
  }
  if (resolutionPreset === "custom") {
    return {
      resolutionPreset,
      maxWidth: clampEven(customWidth, 160, 4096),
      maxHeight: clampEven(customHeight, 160, 4096),
      videoCodec,
      jpegQuality
    };
  }

  return { resolutionPreset, videoCodec, jpegQuality };
}

function withOutputSettings<T extends { frameTimeSeconds: number }>(request: T, settings: OutputSettings): T & OutputSettings {
  return {
    ...request,
    resolutionPreset: settings.resolutionPreset,
    maxWidth: settings.maxWidth,
    maxHeight: settings.maxHeight,
    videoCodec: settings.videoCodec,
    jpegQuality: settings.jpegQuality
  };
}

function requireVideo(videoFile: File | null, message: string): File {
  if (!videoFile) {
    throw new Error(message);
  }

  return videoFile;
}

function clampEven(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, Math.round(value)));
  return clamped - clamped % 2;
}

function matchesAccept(file: File, accept: string): boolean {
  if (accept === "image/*") {
    return file.type.startsWith("image/") || /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
  }
  if (accept === "video/*") {
    return file.type.startsWith("video/") || /\.(m4v|mkv|mov|mp4|mpeg|mpg|webm)$/i.test(file.name);
  }

  return true;
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = unitIndex === 0 || value >= 10 ? Math.round(value).toString() : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function readStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return "zh";
  }

  const queryLanguage = new URLSearchParams(window.location.search).get("lang");
  if (queryLanguage === "en" || queryLanguage === "zh") {
    return queryLanguage;
  }

  return localStorage.getItem("live-motion-language") === "en" ? "en" : "zh";
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = localStorage.getItem("live-motion-theme");
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function detectOutputKindFromUa(): OutputKind {
  if (typeof navigator === "undefined") {
    return "android";
  }

  const ua = navigator.userAgent || "";
  const isiPadOsDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || isiPadOsDesktopMode ? "ios" : "android";
}

function readStoredOption<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = localStorage.getItem(key) as T | null;
  return stored && allowed.includes(stored) ? stored : fallback;
}

function readStoredNumber(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = Number(localStorage.getItem(key));
  if (!Number.isFinite(stored)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(stored)));
}
