"use client";
// 顔写真のアップロード。選んだ時点で条件を検査し、不適合なら理由を日本語で表示する。
// 縦横比が少し違うときは自動で切り抜き、位置をスライダーで調整できる。

import { useEffect, useRef, useState } from "react";
import { checkFileBasics, checkImage, cropAndResize, loadImage, type ImageCheck } from "@/lib/image";
import { getStore, usePhotoUrl } from "@/lib/store";
import type { ImageRule } from "@/lib/types";

interface Pending {
  img: HTMLImageElement;
  url: string;
  info: { type: string; bytes: number; width: number; height: number };
}

export function PhotoInput({
  value,
  onChange,
  rule,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  rule: ImageRule;
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
      setOffset(0.3);
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
      const blob = await cropAndResize(pending.img, check.crop, rule.storeLongSide);
      const key = await getStore().putPhoto(blob);
      onChange(key);
      setPending(null);
    } catch (e) {
      setReasons([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  const ratio = rule.aspect ? `${rule.aspect.w} / ${rule.aspect.h}` : undefined;

  return (
    <div className="photo-input">
      <p className="hint">
        条件：{rule.types.map((t) => t.replace("image/", "").toUpperCase()).join("・")}形式／
        {rule.aspect ? `縦${rule.aspect.h}:横${rule.aspect.w}の縦長／` : ""}短い辺が{rule.minShortSide}px以上／{rule.maxMB}MBまで
      </p>

      {pending && check?.ok ? (
        <div className="photo-pending">
          <div className="photo-frame" style={{ aspectRatio: ratio }}>
            <CropPreview pending={pending} crop={check.crop} />
          </div>
          <div className="photo-side">
            <p className="ok-text">✓ 条件を満たしています（{check.crop.width}×{check.crop.height}px で使用）</p>
            {check.cropped && (
              <label className="slider">
                {pending.info.width / pending.info.height > (rule.aspect!.w / rule.aspect!.h) ? "左右" : "上下"}の位置を調整
                <input type="range" min={0} max={1} step={0.01} value={offset} onChange={(e) => setOffset(+e.target.value)} />
              </label>
            )}
            <div className="row">
              <button type="button" className="btn primary" onClick={confirm} disabled={busy}>
                {busy ? "保存中…" : "この写真を使う"}
              </button>
              <button type="button" className="btn" onClick={() => setPending(null)}>
                選び直す
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="photo-current">
          <div className="photo-frame" style={{ aspectRatio: ratio }}>
            {current ? <img src={current} alt="登録済みの写真" /> : <span className="photo-empty">写真なし</span>}
          </div>
          <div className="photo-side">
            <input ref={fileRef} type="file" accept={rule.types.join(",")} onChange={(e) => onFile(e.target.files?.[0])} hidden />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              {current ? "写真を変更する" : "写真を選ぶ"}
            </button>
            {current && (
              <button type="button" className="btn link danger" onClick={() => onChange(null)}>
                写真を削除
              </button>
            )}
          </div>
        </div>
      )}

      {reasons.length > 0 && (
        <div className="photo-ng" role="alert">
          <p className="issue-head error">この写真は使えません</p>
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
      alt="選んだ写真のプレビュー"
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
