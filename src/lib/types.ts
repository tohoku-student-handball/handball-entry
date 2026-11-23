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
  submitted: "提出済（確認待ち）",
  region_approved: "地区承認済",
  office_confirmed: "確認済（受付完了）",
  returned: "差し戻し",
};

export type TournamentKind = "national" | "league";
export const TOURNAMENT_KIND_LABEL: Record<TournamentKind, string> = { national: "全日本・全国大会", league: "リーグ戦" };

/** 大会ごとに使う機能 */
export interface Features {
  /** パンフレット（顔写真・集合写真・ロゴ） */
  pamphlet: boolean;
  /** 傷害保険 */
  insurance: boolean;
  /** 交通・宿泊・弁当 */
  travel: boolean;
  /** 試合日程・結果・順位表 */
  matches: boolean;
  /** 引率責任者の届出 */
  escort: boolean;
  /** 紙の申込書（原本）の郵送 */
  paper: boolean;
}
export const ALL_FEATURES: Features = { pamphlet: true, insurance: true, travel: true, matches: false, escort: true, paper: true };
export const FEATURE_LABEL: Record<keyof Features, string> = {
  pamphlet: "パンフレット（顔写真・集合写真・ロゴ）",
  insurance: "傷害保険",
  travel: "交通・宿泊・弁当",
  matches: "試合日程・結果・順位表",
  escort: "引率責任者の届出",
  paper: "申込書原本の郵送",
};

/** 大会（全日本学生選手権・春季リーグなど） */
export interface TournamentInfo {
  id: string;
  name: string;
  shortName: string;
  kind: TournamentKind;
  /** 年度（部員名簿の年度） */
  academicYear: number;
  season: "" | "spring" | "autumn";
  organizer: string;
  /** two_step：地区学連→事務局 ／ one_step：主催者のみ */
  reviewFlow: "two_step" | "one_step";
  features: Features;
}

/** 部（リーグの男子1部など） */
export interface Division {
  id: string;
  gender: Gender;
  name: string;
  sortOrder: number;
  entryFee: number | null;
}

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
  /** 申込締切 YYYY-MM-DD（表示用） */
  entryDeadline: string;
  /** 申込締切の日時（ISO形式。ロックの判定に使う） */
  entryDeadlineAt: string;
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
  code: string;
  name: string;
  sortOrder: number;
}

export type Role = "team" | "region" | "office" | "agency" | "scorer";
export const ROLE_LABEL: Record<Role, string> = {
  team: "チーム担当者",
  region: "地区学連",
  office: "事務局（主催者）",
  agency: "旅行社",
  scorer: "記録員",
};

/** 所属（ログインしたメールアドレスごとの役割） */
export interface Membership {
  id: string;
  email: string;
  role: Role;
  universityId: string | null;
  regionId: string | null;
  displayName: string;
  invitedAt: string | null;
}

/** その年度に参加する大学と所属地区 */
export interface TournamentUniversity {
  universityId: string;
  regionId: string;
  menDivisionId: string | null;
  womenDivisionId: string | null;
}

export type UniformUse = "CP" | "GK";
export type UniformTone = "dark" | "light";
export interface Uniform {
  id: string;
  teamId: string;
  use: UniformUse;
  color: string;
  tone: UniformTone;
  sponsor: boolean;
}

export type AssetKind = "group" | "logo";
export const ASSET_LABEL: Record<AssetKind, string> = { group: "チーム集合写真", logo: "チームロゴ" };
export interface TeamAsset {
  id: string;
  teamId: string;
  kind: AssetKind;
  path: string;
  width: number | null;
  height: number | null;
}

export type ReviewAction = "submit" | "approve" | "return" | "confirm" | "unlock" | "note";
export const REVIEW_ACTION_LABEL: Record<ReviewAction, string> = {
  submit: "提出",
  approve: "地区学連が承認",
  return: "差し戻し",
  confirm: "事務局が確認",
  unlock: "ロック解除",
  note: "メモ",
};
export interface ReviewComment {
  id: string;
  teamId: string;
  authorEmail: string;
  authorRole: string;
  action: ReviewAction;
  body: string;
  createdAt: string;
}

export type PaperStatus = "not_sent" | "sent" | "received";
export const PAPER_STATUS_LABEL: Record<PaperStatus, string> = {
  not_sent: "未送付",
  sent: "郵送済",
  received: "到着確認済",
};

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
  tournamentId: string;
  universityId: string;
  gender: Gender;
  regionId: string;
  /** 部（リーグのみ） */
  divisionId: string | null;
  status: TeamStatus;
  displayName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  jhaNumber: string;
  studentFedNumber: string;
  escort: Escort;
  comment: string;
  /** JHA・全日本学連の登録を事務局が確認した */
  registrationConfirmed: boolean;
  paperStatus: PaperStatus;
  /** 事務局が締切後のロックを解除している期限（ISO形式） */
  unlockedUntil: string | null;
  submittedAt: string | null;
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

/** 年度の部員名簿の1人（人に関する情報。全大会で共通） */
export interface RosterPerson {
  id: string;
  universityId: string;
  gender: Gender;
  academicYear: number;
  kind: MemberKind;
  name: string;
  kana: string;
  birthDate: string;
  grade: number | null;
  faculty: string;
  position: string;
  highSchool: string;
  heightCm: number | null;
  weightKg: number | null;
  handedness: string;
  foreignStatus: ForeignStatus;
  /** 役員：ふだんの役職 */
  defaultTitle: string;
  /** 役員：学生かどうか */
  isStudent: boolean;
  photoKey: string | null;
  photoConsent: boolean;
  dopingConsentChecked: boolean;
  /** 名簿に載っているか（退部などで外した人は false） */
  active: boolean;
  updatedAt: string;
}

/** 大会ごとのエントリー（名簿の人を選び、その大会の背番号・ベンチを決める） */
export interface Entry {
  id: string;
  teamId: string;
  personId: string;
  isEntry: boolean;
  number: number | null;
  bench: boolean;
  title: string;
  insuranceOptIn: boolean;
}

/**
 * 画面とルール判定で使う「名簿＋エントリー」を合わせた形。
 * id はエントリーの id、personId は名簿の人の id。
 */
export interface Member {
  id: string;
  personId: string;
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
  /** 顔写真の保存場所 */
  photoKey: string | null;
  photoConsent: boolean;
  dopingConsentChecked: boolean;
  updatedAt: string;
}

export function emptyPerson(universityId: string, gender: Gender, academicYear: number, kind: MemberKind): RosterPerson {
  return {
    id: "",
    universityId,
    gender,
    academicYear,
    kind,
    name: "",
    kana: "",
    birthDate: "",
    grade: null,
    faculty: "",
    position: "",
    highSchool: "",
    heightCm: null,
    weightKg: null,
    handedness: "",
    foreignStatus: "none",
    defaultTitle: kind === "staff" ? "監督" : "",
    isStudent: false,
    photoKey: null,
    photoConsent: false,
    dopingConsentChecked: false,
    active: true,
    updatedAt: "",
  };
}

/** 名簿の人とエントリーを合わせる */
export function toMember(p: RosterPerson, e: Entry): Member {
  return {
    id: e.id,
    personId: p.id,
    teamId: e.teamId,
    kind: p.kind,
    name: p.name,
    kana: p.kana,
    birthDate: p.birthDate,
    isEntry: e.isEntry,
    number: e.number,
    grade: p.grade,
    faculty: p.faculty,
    position: p.position,
    highSchool: p.highSchool,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    handedness: p.handedness,
    foreignStatus: p.foreignStatus,
    bench: e.bench,
    title: e.title || p.defaultTitle,
    isStudent: p.isStudent,
    insuranceOptIn: e.insuranceOptIn,
    photoKey: p.photoKey,
    photoConsent: p.photoConsent,
    dopingConsentChecked: p.dopingConsentChecked,
    updatedAt: p.updatedAt,
  };
}

/** 名簿の人を、ルール判定用に「エントリーしたもの」として扱う（名簿画面のチェック用） */
export function personAsMember(p: RosterPerson): Member {
  return toMember(p, { id: p.id, teamId: "", personId: p.id, isEntry: true, number: null, bench: false, title: "", insuranceOptIn: false });
}

export function emptyMember(teamId: string, kind: MemberKind): Member {
  return {
    id: "",
    personId: "",
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
