// 画像の検査と加工。
// checkImage は純粋な関数（テスト可能）。loadImage / cropAndResize はブラウザでのみ動きます。

import type { ImageRule } from "./types";

export interface ImageInfo {
  type: string;
  bytes: number;
  width: number;
  height: number;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ImageCheck =
  | { ok: true; crop: CropBox; cropped: boolean }
  | { ok: false; reasons: string[] };

const TYPE_LABEL: Record<string, string> = { "image/jpeg": "JPEG", "image/png": "PNG" };

/** 形式と容量だけを検査する（画像を読み込む前に使う） */
export function checkFileBasics(info: { type: string; bytes: number }, rule: ImageRule): string[] {
  const reasons: string[] = [];
  if (!rule.types.includes(info.type)) {
    const allowed = rule.types.map((t) => TYPE_LABEL[t] ?? t).join("・");
    reasons.push(`ファイルの形式が対応していません。${allowed}形式の画像を選んでください。（iPhoneの「HEIC」形式の写真は、設定＞カメラ＞フォーマットを「互換性優先」にして撮り直すか、JPEGに変換してから選んでください）`);
  }
  if (info.bytes > rule.maxMB * 1024 * 1024) {
    reasons.push(`ファイルの容量が大きすぎます（${(info.bytes / 1024 / 1024).toFixed(1)}MB）。${rule.maxMB}MB以下にしてください。`);
  }
  return reasons;
}

/**
 * 画像が条件を満たすか検査する。
 * 縦横比が指定されている場合は、条件の比率で切り抜いたあとの大きさで判定する。
 * offsetY / offsetX（0〜1）は切り抜き位置（0=上端・左端, 0.5=中央）。
 */
export function checkImage(info: ImageInfo, rule: ImageRule, offsetY = 0.3, offsetX = 0.5): ImageCheck {
  const reasons = checkFileBasics(info, rule);
  if (reasons.length) return { ok: false, reasons };

  let crop: CropBox = { x: 0, y: 0, width: info.width, height: info.height };
  let cropped = false;
  if (rule.aspect) {
    const { w, h } = rule.aspect;
    const portraitRequired = h > w;
    if (portraitRequired && info.width > info.height) {
      return { ok: false, reasons: ["横長の写真です。縦長の写真を選んでください（顔が中央に来るように撮影してください）。"] };
    }
    const target = w / h;
    const actual = info.width / info.height;
    if (Math.abs(actual - target) > 0.01) {
      cropped = true;
      if (actual > target) {
        // 横に余る → 左右を切る
        const cw = Math.round(info.height * target);
        crop = { x: Math.round((info.width - cw) * clamp01(offsetX)), y: 0, width: cw, height: info.height };
      } else {
        // 縦に余る → 上下を切る
        const ch = Math.round(info.width / target);
        crop = { x: 0, y: Math.round((info.height - ch) * clamp01(offsetY)), width: info.width, height: ch };
      }
    }
  }

  const shortSide = Math.min(crop.width, crop.height);
  if (shortSide < rule.minShortSide) {
    const sizeText = cropped
      ? `縦${rule.aspect!.h}:横${rule.aspect!.w}に切り抜くと ${crop.width}×${crop.height}px`
      : `${info.width}×${info.height}px`;
    return {
      ok: false,
      reasons: [`画像が小さすぎます（${sizeText}）。短い辺が${rule.minShortSide}px以上の画像を選んでください。スマホのカメラで撮った写真なら通常は条件を満たします（LINEなどで送られて小さくなった画像は避けてください）。`],
    };
  }
  return { ok: true, crop, cropped };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** 長辺を maxLong 以下にしたときの大きさ */
export function fitLongSide(width: number, height: number, maxLong: number) {
  const scale = Math.min(1, maxLong / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// ---- ここから下はブラウザ専用 ----

export async function loadImage(file: File): Promise<{ img: HTMLImageElement; info: ImageInfo; url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("画像を読み込めませんでした。ファイルが壊れていないか確認してください。"));
    img.src = url;
  });
  return { img, url, info: { type: file.type, bytes: file.size, width: img.naturalWidth, height: img.naturalHeight } };
}

/** 切り抜いて縮小する。keepPng=true なら透明部分を残して PNG で保存する（ロゴ用） */
export async function cropAndResize(img: HTMLImageElement, crop: CropBox, maxLong: number, keepPng = false): Promise<Blob> {
  const out = fitLongSide(crop.width, crop.height, maxLong);
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d")!;
  if (!keepPng) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("画像の変換に失敗しました。"))),
      keepPng ? "image/png" : "image/jpeg",
      0.9,
    ),
  );
}
