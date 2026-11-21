"use client";
// 画像のアップロード。選んだ時点で条件を検査し、不適合なら理由を日本語で表示する。
// 縦横比の指定がある場合（顔写真）は自動で切り抜き、位置をスライダーで調整できる。
// 顔写真・集合写真・ロゴで共通に使う。

import { useEffect, useRef, useState } from "react";
import { checkFileBasics, checkImage, cropAndResize, loadImage, type ImageCheck } from "@/lib/image";
import { toMessage, usePhotoUrl } from "@/lib/store";
import type { ImageRule } from "@/lib/types";

interface Pending {
  img: HTMLImageElement;
  url: string;
  info: { type: string; bytes: number; width: number; height: number };
}

export function PhotoInput({
  value,
  onSave,
  onRemove,
  rule,
  disabled,
  wide,
}: {
  /** 今の画像の保存場所 */
  value: string | null;
  /** 加工した画像を保存する */
  onSave: (blob: Blob, width: number, height: number) => Promise<void>;
  onRemove?: () => void | Promise<void>;
  rule: ImageRule;
  disabled?: boolean;
  /** 横長の画像（集合写真）用の大きめの枠 */
  wide?: boolean;
}) {
  const current = usePhotoUrl(value);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [offset, setOffset] = useState(0.3);
  const [reasons, setReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.url);
  }, [pending]);

  const check: ImageCheck | null = pending ? checkImage(pending.info, rule, offset, offset) : null;

  async function onFile(file: File | undefined) {
    setReasons([]);
    setPending(null);
    if (!file) return;
    // 形式・容量は読み込む前に判定する
    const pre = checkFileBasics({ type: file.type, bytes: file.size }, rule);
    if (pre.length) {
      setReasons(pre);
      return;
    }
    try {
      const loaded = await loadImage(file);
      const r = checkImage(loaded.info, rule, 0.3, 0.5);
      if (!r.ok) {
        setReasons(r.reasons);
        URL.revokeObjectURL(loaded.url);
        return;
      }
      setOffset(rule.aspect ? 0.3 : 0.5);
      setPending(loaded);
    } catch (e) {
      setReasons([(e as Error).message]);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirm() {
    if (!pending || !check?.ok) return;
    setBusy(true);
    try {
      // ロゴなど縦横比の指定がない PNG は、透明部分を残す
      const keepPng = !rule.aspect && pending.info.type === "image/png";
      const blob = await cropAndResize(pending.img, check.crop, rule.storeLongSide, keepPng);
      const scale = Math.min(1, rule.storeLongSide / Math.max(check.crop.width, check.crop.height));
      await onSave(blob, Math.round(check.crop.width * scale), Math.round(check.crop.height * scale));
      setPending(null);
    } catch (e) {
      setReasons([toMessage(e)]);
    } finally {
      setBusy(false);
    }
  }

  const ratio = rule.aspect ? `${rule.aspect.w} / ${rule.aspect.h}` : undefined;
  const frameClass = "photo-frame" + (wide ? " wide" : "");

  return (
    <div className="photo-input">
      <p className="hint">
        条件：{rule.types.map((t) => t.replace("image/", "").toUpperCase()).join("・")}形式／
        {rule.aspect ? `縦${rule.aspect.h}:横${rule.aspect.w}の縦長／` : ""}短い辺が{rule.minShortSide}px以上／{rule.maxMB}MBまで
      </p>

      {pending && check?.ok ? (
        <div className={"photo-pending" + (wide ? " stack-narrow" : "")}>
          <div className={frameClass} style={{ aspectRatio: ratio ?? `${pending.info.width} / ${pending.info.height}` }}>
            <CropPreview pending={pending} crop={check.crop} />
          </div>
          <div className="photo-side">
            <p className="ok-text">✓ 条件を満たしています（{check.crop.width}×{check.crop.height}px で使用）</p>
            {check.cropped && (
              <label className="slider">
                {pending.info.width / pending.info.height > rule.aspect!.w / rule.aspect!.h ? "左右" : "上下"}の位置を調整
                <input type="range" min={0} max={1} step={0.01} value={offset} onChange={(e) => setOffset(+e.target.value)} />
              </label>
            )}
            <div className="row">
              <button type="button" className="btn primary" onClick={confirm} disabled={busy}>
                {busy ? "保存中…" : "この画像を使う"}
              </button>
              <button type="button" className="btn" onClick={() => setPending(null)} disabled={busy}>
                選び直す
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={"photo-current" + (wide ? " stack-narrow" : "")}>
          <div className={frameClass} style={{ aspectRatio: ratio ?? (wide ? "3 / 2" : "1 / 1") }}>
            {current ? <img src={current} alt="登録済みの画像" /> : <span className="photo-empty">{value ? "読み込み中…" : "未登録"}</span>}
          </div>
          {!disabled && (
            <div className="photo-side">
              <input ref={fileRef} type="file" accept={rule.types.join(",")} onChange={(e) => onFile(e.target.files?.[0])} hidden />
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                {value ? "画像を変更する" : "画像を選ぶ"}
              </button>
              {value && onRemove && (
                <button type="button" className="btn link danger" onClick={() => onRemove()}>
                  画像を削除
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {reasons.length > 0 && (
        <div className="photo-ng" role="alert">
          <p className="issue-head error">この画像は使えません</p>
          <ul>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CropPreview({ pending, crop }: { pending: Pending; crop: { x: number; y: number; width: number; height: number } }) {
  const { width: W, height: H } = pending.info;
  // 切り抜き範囲が枠いっぱいになるように元画像を拡大・移動して表示
  return (
    <img
      src={pending.url}
      alt="選んだ画像のプレビュー"
      style={{
        position: "absolute",
        width: `${(W / crop.width) * 100}%`,
        height: `${(H / crop.height) * 100}%`,
        left: `${(-crop.x / crop.width) * 100}%`,
        top: `${(-crop.y / crop.height) * 100}%`,
        maxWidth: "none",
        objectFit: "fill",
      }}
    />
  );
}
