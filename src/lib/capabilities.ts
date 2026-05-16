import type { ProcessingEngine } from "./types";

const MOBILE_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function isProbablyMobile(): boolean {
  return MOBILE_RE.test(navigator.userAgent) || navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent);
}

export function supportsSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== "undefined" && window.crossOriginIsolated === true;
}

export function chooseIosEngine(): ProcessingEngine {
  return !isProbablyMobile() && supportsSharedArrayBuffer() ? "client-wasm" : "server-api";
}

export function describeRoute(output: "ios" | "android"): string {
  if (output === "android") {
    return "前端合成";
  }

  return chooseIosEngine() === "client-wasm" ? "桌面端 WASM" : "移动端后端";
}

export function canUseClientWasm(): boolean {
  return !isProbablyMobile() && supportsSharedArrayBuffer();
}
