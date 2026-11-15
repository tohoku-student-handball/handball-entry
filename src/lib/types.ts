// データの形（docs/03_データ設計.md に対応）。
// データベース（Supabase）では同じ項目を snake_case の列名で持ちます。

export type Gender = "men" | "women";
export const GENDER_LABEL: Record<Gender, string> = { men: "男子", women: "女子" };

export type TeamStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "region_approved"
  | "office_confirmed"
  | "returned";
export const TEAM_STATUS_LABEL: Record<TeamStatus, string> = {
  not_started: "未着手",
  in_progress: "入力中",
  submitted: "提出済（地区学連の確認待ち）",
  region_approved: "地区承認済",
  office_confirmed: "事務局確認済",
  returned: "差し戻し",
};

/** 画像の条件（大会の設定で変更可） */
export interface ImageRule {
  /** 受け付ける形式（MIMEタイプ） */
  types: string[];
  /** 短辺の最小ピクセル数（切り抜き後） */
  minShortSide: number;
  /** 縦横比（幅:高さ）。null は指定なし */
  aspect: { w: number; h: number } | null;
  /** 最大容量（MB） */
  maxMB: number;
  /** 保存時に縮小する長辺のピクセル数 */
  storeLongSide: number;
}

/** 大会の設定（管理画面で変更する値。初期値はR8年度要項） */
export interface TournamentSettings {
  name: string;
  /** 大会初日（未成年の判定に使う）YYYY-MM-DD */
  startDate: string;
  /** 申込締切 YYYY-MM-DD */
  entryDeadline: string;
  limits: {
    staffMax: number;
    playerEntryMax: number;
    benchStaffMax: number;
    benchPlayerMax: number;
    foreignEntryMax: number;
    foreignGameEntryMax: number;
    numberMin: number;
    numberMax: number;
  };
  fees: { entry: number; insurancePerPerson: number; sponsorUniform: number };
  /** 成年年齢（未成年判定） */
  adultAge: number;
  images: { face: ImageRule; group: ImageRule; logo: ImageRule };
  /** パンフレットの文字数上限 */
  textLimits: { name: number; highSchool: number; faculty: number; teamComment: number };
}

export interface University {
  id: string;
  name: string;
  kana: string;
}

export interface Region {
  id: string;
  name: string;
}

export interface Escort {
  name: string;
  title: string;
  /** 専任教職員、または部長が任命した者であることを確認した */
  qualified: boolean;
  /** 役員名簿のうち、誰が引率責任者か（未登録なら null） */
  staffMemberId: string | null;
}

export interface Team {
  id: string;
  universityId: string;
  gender: Gender;
  regionId: string;
  status: TeamStatus;
  displayName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  jhaNumber: string;
  studentFedNumber: string;
  escort: Escort;
  comment: string;
  updatedAt: string;
}

export type MemberKind = "player" | "staff";
export type ForeignStatus = "none" | "foreign" | "short_term";
export const FOREIGN_LABEL: Record<ForeignStatus, string> = {
  none: "該当なし",
  foreign: "留学生",
  short_term: "短期留学生",
};

export const POSITIONS = ["GK", "LW", "LB", "CB", "RB", "RW", "PV"] as const;
export const POSITION_LABEL: Record<string, string> = {
  GK: "GK（ゴールキーパー）",
  LW: "LW（左サイド）",
  LB: "LB（左バック）",
  CB: "CB（センターバック）",
  RB: "RB（右バック）",
  RW: "RW（右サイド）",
  PV: "PV（ポスト）",
};
export const HANDEDNESS = ["右", "左", "両"] as const;
export const STAFF_TITLES = ["部長", "監督", "コーチ", "トレーナー", "マネージャー", "その他"] as const;

export interface Member {
  id: string;
  teamId: string;
  kind: MemberKind;
  name: string;
  kana: string;
  birthDate: string; // YYYY-MM-DD
  /** 選手：エントリー（25名）なら true。false は「氏名のみ掲載」 */
  isEntry: boolean;
  number: number | null;
  grade: number | null;
  faculty: string;
  position: string;
  highSchool: string;
  heightCm: number | null;
  weightKg: number | null;
  handedness: string;
  foreignStatus: ForeignStatus;
  bench: boolean;
  /** 役員：役職 */
  title: string;
  /** 役員：学生かどうか（学生役員は保険加入必須） */
  isStudent: boolean;
  /** 役員（学生以外）：保険に任意加入するか */
  insuranceOptIn: boolean;
  photoKey: string | null;
  photoConsent: boolean;
  dopingConsentChecked: boolean;
  updatedAt: string;
}

export function emptyMember(teamId: string, kind: MemberKind): Member {
  return {
    id: "",
    teamId,
    kind,
    name: "",
    kana: "",
    birthDate: "",
    isEntry: kind === "player",
    number: null,
    grade: null,
    faculty: "",
    position: "",
    highSchool: "",
    heightCm: null,
    weightKg: null,
    handedness: "",
    foreignStatus: "none",
    bench: false,
    title: kind === "staff" ? "監督" : "",
    isStudent: false,
    insuranceOptIn: false,
    photoKey: null,
    photoConsent: false,
    dopingConsentChecked: false,
    updatedAt: "",
  };
}
