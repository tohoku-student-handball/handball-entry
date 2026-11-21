import type { ImageRule, TournamentSettings } from "./types";

const JPEG_PNG = ["image/jpeg", "image/png"];

const face: ImageRule = {
  types: JPEG_PNG,
  minShortSide: 600,
  aspect: { w: 3, h: 4 },
  maxMB: 10,
  storeLongSide: 1600,
};

/**
 * 大会の設定の初期値（R8年度要項の値を仮置き）。
 * 本番では事務局が管理画面で変更し、データベースに保存します。
 */
export const DEFAULT_SETTINGS: TournamentSettings = {
  name: "令和9年度 全日本学生ハンドボール選手権大会",
  startDate: "2027-11-06",
  entryDeadline: "2027-10-01",
  entryDeadlineAt: "2027-10-01T23:59:59+09:00",
  limits: {
    staffMax: 6,
    playerEntryMax: 25,
    benchStaffMax: 5,
    benchPlayerMax: 16,
    foreignEntryMax: 3,
    foreignGameEntryMax: 2,
    numberMin: 1,
    numberMax: 99,
  },
  fees: { entry: 75000, insurancePerPerson: 500, sponsorUniform: 10000 },
  adultAge: 18,
  images: {
    face,
    group: { types: JPEG_PNG, minShortSide: 1200, aspect: null, maxMB: 20, storeLongSide: 3000 },
    logo: { types: JPEG_PNG, minShortSide: 600, aspect: null, maxMB: 10, storeLongSide: 2000 },
  },
  textLimits: { name: 10, highSchool: 14, faculty: 10, teamComment: 120 },
};
