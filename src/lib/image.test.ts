import { describe, expect, it } from "vitest";
import { checkImage, fitLongSide } from "./image";
import { DEFAULT_SETTINGS } from "./settings";

const face = DEFAULT_SETTINGS.images.face;
const jpeg = (width: number, height: number, bytes = 2_000_000) => ({ type: "image/jpeg", bytes, width, height });

describe("checkImage（顔写真：3:4・短辺600px以上）", () => {
  it("ちょうど3:4で十分な大きさなら切り抜きなしで合格", () => {
    const r = checkImage(jpeg(900, 1200), face);
    expect(r).toEqual({ ok: true, crop: { x: 0, y: 0, width: 900, height: 1200 }, cropped: false });
  });
  it("スマホの縦写真（3024×4032）は合格", () => {
    expect(checkImage(jpeg(3024, 4032), face).ok).toBe(true);
  });
  it("縦に長すぎる写真は上下を切り抜いて合格", () => {
    const r = checkImage(jpeg(1080, 1920), face, 0.5);
    expect(r.ok && r.cropped).toBe(true);
    if (r.ok) expect(r.crop).toEqual({ x: 0, y: 240, width: 1080, height: 1440 });
  });
  it("横長の写真は不合格", () => {
    const r = checkImage(jpeg(1200, 900), face);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toContain("横長");
  });
  it("小さい写真は不合格で、理由に大きさを含む", () => {
    const r = checkImage(jpeg(480, 640), face);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toContain("480×640px");
  });
  it("切り抜くと小さくなる写真も不合格", () => {
    // 正方形 700×700 → 3:4 に切り抜くと 525×700
    const r = checkImage(jpeg(700, 700), face);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toContain("525×700px");
  });
  it("HEIC は形式エラー", () => {
    const r = checkImage({ type: "image/heic", bytes: 1, width: 3000, height: 4000 }, face);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toContain("JPEG・PNG");
  });
  it("10MBを超えると容量エラー", () => {
    const r = checkImage(jpeg(3000, 4000, 11 * 1024 * 1024), face);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toContain("10MB");
  });
});

describe("fitLongSide", () => {
  it("長辺を指定サイズに縮小し、小さい画像は拡大しない", () => {
    expect(fitLongSide(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitLongSide(600, 800, 1600)).toEqual({ width: 600, height: 800 });
  });
});
