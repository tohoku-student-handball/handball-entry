"use client";
// デモ版のデータ保存先。入力内容はブラウザの中だけ（データ＝localStorage、写真＝IndexedDB）に保存します。
// 本番（Supabase）と同じ動きになるよう、提出・承認・差し戻しのルールもここでまねています。
// サンプルとして「令和9年度 全日本学生選手権」と「令和9年度 春季東北学生リーグ」の2大会を用意しています。

import { DEFAULT_SETTINGS } from "./settings";
import { BaseStore, emptySnapshot, type DataStore, type NewMembership, type Snapshot, type TournamentPatch } from "./store";
import type {
  AssetKind,
  Division,
  Entry,
  Gender,
  Membership,
  Region,
  ReviewComment,
  Role,
  RosterPerson,
  Team,
  TeamAsset,
  TournamentInfo,
  TournamentSettings,
  TournamentUniversity,
  Uniform,
  University,
} from "./types";
import { emptyPerson } from "./types";

const LS_KEY = "handball-entry-demo-v3";
const DB_NAME = "handball-entry-demo-photos";
const DEMO_EMAIL = "demo@example.com";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

type T<X> = X & { tournamentId: string };
interface DemoDb {
  version: 3;
  currentTournamentId: string;
  tournaments: (TournamentInfo & { settings: TournamentSettings })[];
  regions: T<Region>[];
  divisions: T<Division>[];
  universities: University[];
  tus: T<TournamentUniversity>[];
  memberships: T<Membership>[];
  roster: RosterPerson[];
  teams: Team[];
  entries: Entry[];
  uniforms: Uniform[];
  assets: TeamAsset[];
  comments: ReviewComment[];
}

// ---- 写真（IndexedDB） ----
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("この環境では写真を保存できません。"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb<X>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<X> {
  const db = await openDb();
  return new Promise<X>((resolve, reject) => {
    const tx = db.transaction("photos", mode);
    const req = fn(tx.objectStore("photos"));
    req.onsuccess = () => resolve(req.result as X);
    req.onerror = () => reject(req.error);
  });
}

// ---- サンプルデータ ----
const SURNAMES = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本", "井上"];
const GIVEN = ["翔太", "大輝", "拓海", "蓮", "陽斗", "悠真", "健太", "颯", "湊", "大和", "陸", "海斗", "優斗", "蒼", "樹", "隼"];
const KANA_S = ["さとう", "すずき", "たかはし", "たなか", "いとう", "わたなべ", "やまもと", "なかむら", "こばやし", "かとう", "よしだ", "やまだ", "ささき", "やまぐち", "まつもと", "いのうえ"];
const KANA_G = ["しょうた", "だいき", "たくみ", "れん", "はると", "ゆうま", "けんた", "はやて", "みなと", "やまと", "りく", "かいと", "ゆうと", "あおい", "いつき", "しゅん"];
const POS = ["GK", "LW", "LB", "CB", "RB", "RW", "PV", "CB", "LB", "RB", "GK", "PV", "LW", "RW", "CB", "LB"];

function person(universityId: string, gender: Gender, kind: "player" | "staff", p: Partial<RosterPerson>): RosterPerson {
  return { ...emptyPerson(universityId, gender, 2027, kind), id: newId(), updatedAt: now(), ...p };
}

/** 入力がそろった架空の部員を作る */
function fullRoster(universityId: string, gender: Gender, n: number, seedNo: number): RosterPerson[] {
  const staff = person(universityId, gender, "staff", { name: "監督 一郎", kana: "かんとく いちろう", birthDate: "1978-05-01", defaultTitle: "監督" });
  const players = Array.from({ length: n }, (_, i) => {
    const k = (i + seedNo) % 16;
    return person(universityId, gender, "player", {
      name: `${SURNAMES[k]} ${GIVEN[(k * 7 + seedNo) % 16]}`,
      kana: `${KANA_S[k]} ${KANA_G[(k * 7 + seedNo) % 16]}`,
      birthDate: `200${3 + (i % 4)}-0${1 + (i % 9)}-1${i % 9}`,
      grade: 1 + (i % 4),
      faculty: ["教育学部", "経済学部", "工学部", "文学部"][i % 4],
      position: POS[i % 16],
      highSchool: ["宮城県立青葉高校", "岩手県立北上高校", "秋田県立雄物高校", "福島県立会津高校"][i % 4],
      heightCm: 168 + ((i * 3) % 22),
      weightKg: 62 + ((i * 5) % 25),
      handedness: i % 5 === 0 ? "左" : "右",
    });
  });
  return [staff, ...players];
}

function entriesFor(teamId: string, people: RosterPerson[], benchMax = 16): Entry[] {
  let num = 0;
  return people.map((p) => ({
    id: newId(),
    teamId,
    personId: p.id,
    isEntry: true,
    number: p.kind === "player" ? ++num : null,
    bench: p.kind === "staff" || num <= benchMax,
    title: "",
    insuranceOptIn: false,
  }));
}

function fullUniforms(teamId: string): Uniform[] {
  return [
    { id: newId(), teamId, use: "CP", color: "紺", tone: "dark", sponsor: false },
    { id: newId(), teamId, use: "CP", color: "白", tone: "light", sponsor: false },
    { id: newId(), teamId, use: "GK", color: "黒", tone: "dark", sponsor: false },
    { id: newId(), teamId, use: "GK", color: "黄", tone: "light", sponsor: false },
  ];
}

function blankTeam(tournamentId: string, universityId: string, gender: Gender, regionId: string, name: string, divisionId: string | null = null): Team {
  return {
    id: newId(),
    tournamentId,
    universityId,
    gender,
    regionId,
    divisionId,
    status: "not_started",
    displayName: name,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    jhaNumber: "",
    studentFedNumber: "",
    escort: { name: "", title: "", qualified: false, staffMemberId: null },
    comment: "",
    registrationConfirmed: false,
    paperStatus: "not_sent",
    unlockedUntil: null,
    submittedAt: null,
    updatedAt: now(),
  };
}

function filled(team: Team, staffId: string, seedNo: number): Team {
  return {
    ...team,
    contactName: "主務 花子",
    contactPhone: "022-000-0000",
    contactEmail: "contact@example.com",
    jhaNumber: "0400" + seedNo,
    studentFedNumber: "R9-" + seedNo,
    escort: { name: "監督 一郎", title: "准教授", qualified: true, staffMemberId: staffId },
  };
}

function seed(): DemoDb {
  const t = now();
  const NAT = "demo-national";
  const LG = "demo-league";
  const db: DemoDb = {
    version: 3,
    currentTournamentId: NAT,
    tournaments: [
      {
        id: NAT, name: "令和9年度 全日本学生ハンドボール選手権大会", shortName: "全日本学生選手権", kind: "national", academicYear: 2027,
        season: "", organizer: "全日本学生ハンドボール連盟", reviewFlow: "two_step",
        features: { pamphlet: true, insurance: true, travel: true, matches: false, escort: true, paper: true },
        settings: DEFAULT_SETTINGS,
      },
      {
        id: LG, name: "令和9年度 春季東北学生ハンドボールリーグ", shortName: "春季リーグ", kind: "league", academicYear: 2027,
        season: "spring", organizer: "東北学生ハンドボール連盟", reviewFlow: "one_step",
        features: { pamphlet: false, insurance: false, travel: false, matches: true, escort: false, paper: false },
        settings: { ...DEFAULT_SETTINGS, name: "令和9年度 春季東北学生ハンドボールリーグ", startDate: "2027-05-08", entryDeadline: "2027-04-09", entryDeadlineAt: "2027-04-09T23:59:59+09:00", fees: { entry: 30000, insurancePerPerson: 0, sponsorUniform: 0 } },
      },
    ],
    regions: [
      ...[["hokkaido", "北海道"], ["tohoku", "東北"], ["kanto", "関東"], ["hokushinetsu", "北信越"], ["tokai", "東海"], ["kansai", "関西"], ["chushikoku", "中四国"], ["kyushu", "九州"]].map(
        ([code, name], i) => ({ id: code, code, name, sortOrder: i + 1, tournamentId: NAT }),
      ),
      { id: "lg-tohoku", code: "tohoku", name: "東北", sortOrder: 1, tournamentId: LG },
    ],
    divisions: [
      { id: "lg-m1", tournamentId: LG, gender: "men", name: "男子1部", sortOrder: 1, entryFee: null },
      { id: "lg-m2", tournamentId: LG, gender: "men", name: "男子2部", sortOrder: 2, entryFee: null },
      { id: "lg-w", tournamentId: LG, gender: "women", name: "女子", sortOrder: 3, entryFee: null },
    ],
    universities: [
      { id: "u-sample", name: "サンプル大学", kana: "サンプルダイガク" },
      { id: "u-mori", name: "杜の都大学", kana: "モリノミヤコダイガク" },
      { id: "u-kita", name: "北上川大学", kana: "キタカミガワダイガク" },
      { id: "u-musa", name: "武蔵野テスト大学", kana: "ムサシノテストダイガク" },
    ],
    tus: [
      { tournamentId: NAT, universityId: "u-sample", regionId: "tohoku", menDivisionId: null, womenDivisionId: null },
      { tournamentId: NAT, universityId: "u-mori", regionId: "tohoku", menDivisionId: null, womenDivisionId: null },
      { tournamentId: NAT, universityId: "u-kita", regionId: "tohoku", menDivisionId: null, womenDivisionId: null },
      { tournamentId: NAT, universityId: "u-musa", regionId: "kanto", menDivisionId: null, womenDivisionId: null },
      { tournamentId: LG, universityId: "u-sample", regionId: "lg-tohoku", menDivisionId: "lg-m1", womenDivisionId: "lg-w" },
      { tournamentId: LG, universityId: "u-mori", regionId: "lg-tohoku", menDivisionId: "lg-m1", womenDivisionId: null },
      { tournamentId: LG, universityId: "u-kita", regionId: "lg-tohoku", menDivisionId: "lg-m2", womenDivisionId: "lg-w" },
    ],
    memberships: [],
    roster: [],
    teams: [],
    entries: [],
    uniforms: [],
    assets: [],
    comments: [],
  };
  const mk = (tid: string, role: Role, universityId: string | null, regionId: string | null, email = DEMO_EMAIL, displayName = "デモ 利用者"): T<Membership> => ({
    id: newId(), tournamentId: tid, email, role, universityId, regionId, displayName, invitedAt: t,
  });
  db.memberships = [
    mk(NAT, "team", "u-sample", null), mk(NAT, "region", null, "tohoku"), mk(NAT, "office", null, null),
    mk(NAT, "team", "u-mori", null, "mori-handball@example.com", "杜の都大学 主務"),
    mk(NAT, "team", "u-kita", null, "kitakami@example.com", "北上川大学 顧問"),
    mk(NAT, "team", "u-musa", null, "musashino@example.com", "武蔵野テスト大学 主務"),
    mk(NAT, "region", null, "kanto", "kanto-gakuren@example.com", "関東学連 担当"),
    mk(LG, "team", "u-sample", null), mk(LG, "office", null, null),
    mk(LG, "team", "u-mori", null, "mori-handball@example.com", "杜の都大学 主務"),
    mk(LG, "team", "u-kita", null, "kitakami@example.com", "北上川大学 顧問"),
  ];

  // サンプル大学（男子）の部員名簿：M1と同じ顔ぶれ
  const staffSample = person("u-sample", "men", "staff", { name: "宮城 正樹", kana: "みやぎ まさき", birthDate: "1975-04-10", defaultTitle: "部長" });
  const samplePlayers = [
    { name: "東北 一郎", kana: "とうほく いちろう", position: "GK", grade: 4, faculty: "教育学部", highSchool: "宮城県立青葉高校", heightCm: 185, weightKg: 82, handedness: "右", birthDate: "2005-06-12", photoConsent: true },
    { name: "仙台 健太", kana: "せんだい けんた", position: "CB", grade: 3, faculty: "経済学部", highSchool: "仙台市立杜の都高校", heightCm: 178, weightKg: 74, handedness: "右", birthDate: "2006-02-03", photoConsent: true },
    { name: "青葉 翔", kana: "あおば しょう", position: "LB", grade: 2, faculty: "スポーツ科学部", highSchool: "山形県立最上高校", heightCm: 188, weightKg: 85, handedness: "右", birthDate: "2007-09-20", photoConsent: true },
    { name: "広瀬 蓮", kana: "ひろせ れん", position: "RW", grade: 1, faculty: "工学部", highSchool: "福島県立阿武隈高校", heightCm: 172, weightKg: 66, handedness: "左", birthDate: "2009-12-24", photoConsent: true },
    { name: "名取 大地", kana: "なとり だいち", position: "PV", grade: 1 },
  ].map((p) => person("u-sample", "men", "player", p as Partial<RosterPerson>));
  const sampleRoster = [staffSample, ...samplePlayers];

  const sample = { ...blankTeam(NAT, "u-sample", "men", "tohoku", "サンプル大学"), status: "in_progress" as const };
  sample.escort = { name: "宮城 正樹", title: "教授（部長）", qualified: true, staffMemberId: staffSample.id };
  const numbers = [1, 7, 10, 11];
  const sampleEntries: Entry[] = [
    { id: newId(), teamId: sample.id, personId: staffSample.id, isEntry: true, number: null, bench: true, title: "", insuranceOptIn: false },
    ...samplePlayers.slice(0, 4).map((p, i) => ({ id: newId(), teamId: sample.id, personId: p.id, isEntry: true, number: numbers[i], bench: i < 3, title: "", insuranceOptIn: false })),
    { id: newId(), teamId: sample.id, personId: samplePlayers[4].id, isEntry: false, number: null, bench: false, title: "", insuranceOptIn: false },
  ];

  // ほかの大学
  const moriRoster = fullRoster("u-mori", "men", 20, 1);
  const kitaRoster = fullRoster("u-kita", "women", 14, 5);
  kitaRoster[3].highSchool = "";
  const musaRoster = fullRoster("u-musa", "men", 22, 9);
  const mori = { ...filled(blankTeam(NAT, "u-mori", "men", "tohoku", "杜の都大学"), moriRoster[0].id, 1), status: "submitted" as const, submittedAt: t };
  const kita = { ...filled(blankTeam(NAT, "u-kita", "women", "tohoku", "北上川大学"), kitaRoster[0].id, 5), status: "returned" as const, submittedAt: t };
  const musa = { ...filled(blankTeam(NAT, "u-musa", "men", "kanto", "武蔵野テスト大学"), musaRoster[0].id, 9), status: "region_approved" as const, submittedAt: t, paperStatus: "received" as const };
  // 春季リーグ：杜の都大学（男子1部）が提出済み
  const moriLg = { ...filled(blankTeam(LG, "u-mori", "men", "lg-tohoku", "杜の都大学", "lg-m1"), moriRoster[0].id, 1), status: "submitted" as const, submittedAt: t };

  db.roster = [...sampleRoster, ...moriRoster, ...kitaRoster, ...musaRoster];
  db.teams = [sample, mori, kita, musa, moriLg];
  db.entries = [...sampleEntries, ...entriesFor(mori.id, moriRoster), ...entriesFor(kita.id, kitaRoster), ...entriesFor(musa.id, musaRoster), ...entriesFor(moriLg.id, moriRoster)];
  db.uniforms = [...fullUniforms(mori.id), ...fullUniforms(kita.id), ...fullUniforms(musa.id), ...fullUniforms(moriLg.id)];
  const c = (teamId: string, authorRole: string, action: ReviewComment["action"], body = "", authorEmail = "user@example.com"): ReviewComment => ({ id: newId(), teamId, authorEmail, authorRole, action, body, createdAt: t });
  db.comments = [
    c(mori.id, "team", "submit"),
    c(kita.id, "team", "submit"),
    c(kita.id, "region", "return", "背番号4番の選手の出身高校が空欄です。入力して再提出してください。"),
    c(musa.id, "team", "submit"),
    c(musa.id, "region", "approve"),
    c(moriLg.id, "team", "submit"),
  ];
  return db;
}

export class DemoStore extends BaseStore implements DataStore {
  readonly mode = "demo" as const;
  /** デモで今どの役割として操作しているか（コメントの記録に使う） */
  actingRole: Role = "team";
  private db: DemoDb;

  constructor() {
    super();
    this.db = this.load();
    this.snap = this.view();
  }

  private load(): DemoDb {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw) as DemoDb;
        if (d.version === 3) return d;
      }
    } catch {
      /* 読めなければサンプルから */
    }
    return seed();
  }

  /** いま開いている大会の分だけを、画面用の写しにする */
  private view(): Snapshot {
    const d = this.db;
    const tid = d.currentTournamentId;
    const tour = d.tournaments.find((t) => t.id === tid)!;
    const teams = d.teams.filter((t) => t.tournamentId === tid);
    const teamIds = new Set(teams.map((t) => t.id));
    const inTeams = <X extends { teamId: string }>(xs: X[]) => xs.filter((x) => teamIds.has(x.teamId));
    const strip = <X extends { tournamentId: string }>(x: X) => {
      const { tournamentId: _drop, ...rest } = x;
      void _drop;
      return rest;
    };
    const memberships = d.memberships.filter((m) => m.tournamentId === tid).map(strip);
    return {
      ...emptySnapshot(),
      tournaments: d.tournaments.filter((t) => d.memberships.some((m) => m.tournamentId === t.id && m.email === DEMO_EMAIL)).map(({ settings: _s, ...info }) => (void _s, info)),
      tournamentId: tid,
      settings: tour.settings,
      email: DEMO_EMAIL,
      myMemberships: memberships.filter((m) => m.email === DEMO_EMAIL),
      allMemberships: memberships,
      regions: d.regions.filter((r) => r.tournamentId === tid).map(strip),
      divisions: d.divisions.filter((x) => x.tournamentId === tid).map(strip),
      universities: d.universities,
      tournamentUniversities: d.tus.filter((x) => x.tournamentId === tid).map(strip),
      teams,
      roster: d.roster.filter((p) => p.academicYear === tour.academicYear),
      entries: inTeams(d.entries),
      uniforms: inTeams(d.uniforms),
      assets: inTeams(d.assets),
      comments: inTeams(d.comments),
    };
  }

  private commit(mutate: (d: DemoDb) => void) {
    const next = structuredClone(this.db);
    mutate(next);
    this.db = next;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* 保存できなくても画面は動かす */
    }
    this.setSnapshot(this.view());
  }
  private touchTeam(d: DemoDb, teamId: string) {
    d.teams = d.teams.map((t) => (t.id === teamId ? { ...t, status: t.status === "not_started" ? "in_progress" : t.status, updatedAt: now() } : t));
  }
  private comment(d: DemoDb, teamId: string, action: ReviewComment["action"], body: string) {
    d.comments.push({ id: newId(), teamId, authorEmail: DEMO_EMAIL, authorRole: this.actingRole, action, body, createdAt: now() });
  }

  async selectTournament(id: string) {
    this.commit((d) => {
      if (d.tournaments.some((t) => t.id === id)) d.currentTournamentId = id;
    });
  }

  // ---- 部員名簿 ----
  async savePerson(p: RosterPerson) {
    const saved = { ...p, id: p.id || newId(), updatedAt: now() };
    this.commit((d) => {
      const exists = d.roster.some((x) => x.id === saved.id);
      d.roster = exists ? d.roster.map((x) => (x.id === saved.id ? saved : x)) : [...d.roster, saved];
    });
    return saved;
  }
  async removePerson(id: string) {
    const p = this.person(id);
    const used = this.db.entries.some((e) => e.personId === id);
    if (!used && p?.photoKey) await idb("readwrite", (st) => st.delete(p.photoKey!)).catch(() => {});
    this.commit((d) => {
      d.roster = used ? d.roster.map((x) => (x.id === id ? { ...x, active: false } : x)) : d.roster.filter((x) => x.id !== id);
    });
  }
  async putPersonPhoto(_universityId: string, blob: Blob) {
    const key = newId();
    await idb("readwrite", (st) => st.put(blob, key));
    return key;
  }

  // ---- チームの入力 ----
  async createTeam(universityId: string, gender: Gender) {
    const tid = this.db.currentTournamentId;
    const existing = this.db.teams.find((t) => t.tournamentId === tid && t.universityId === universityId && t.gender === gender);
    if (existing) return existing;
    const tu = this.db.tus.find((x) => x.tournamentId === tid && x.universityId === universityId);
    if (!tu) throw new Error("この大学はこの大会の参加大学として登録されていません。");
    const team = blankTeam(tid, universityId, gender, tu.regionId, this.university(universityId)?.name ?? "", gender === "men" ? tu.menDivisionId : tu.womenDivisionId);
    this.commit((d) => d.teams.push(team));
    return team;
  }
  async saveTeam(team: Team) {
    this.commit((d) => {
      d.teams = d.teams.map((t) =>
        t.id === team.id
          ? { ...team, status: t.status, unlockedUntil: t.unlockedUntil, submittedAt: t.submittedAt, paperStatus: t.paperStatus, registrationConfirmed: t.registrationConfirmed, divisionId: t.divisionId }
          : t,
      );
      this.touchTeam(d, team.id);
    });
  }
  async saveEntries(teamId: string, list: Entry[]) {
    this.commit((d) => {
      d.entries = [...d.entries.filter((e) => e.teamId !== teamId), ...list.map((e) => ({ ...e, id: e.id || newId(), teamId }))];
      this.touchTeam(d, teamId);
    });
  }
  async saveUniforms(teamId: string, uniforms: Uniform[]) {
    this.commit((d) => {
      d.uniforms = [...d.uniforms.filter((u) => u.teamId !== teamId), ...uniforms.map((u) => ({ ...u, id: u.id || newId(), teamId }))];
      this.touchTeam(d, teamId);
    });
  }
  protected async fetchPhoto(path: string) {
    return idb<Blob | undefined>("readonly", (st) => st.get(path));
  }
  async setAsset(teamId: string, kind: AssetKind, blob: Blob, width: number, height: number) {
    const path = await this.putPersonPhoto(teamId, blob);
    this.commit((d) => {
      d.assets = [...d.assets.filter((a) => !(a.teamId === teamId && a.kind === kind)), { id: newId(), teamId, kind, path, width, height }];
      this.touchTeam(d, teamId);
    });
  }
  async removeAsset(teamId: string, kind: AssetKind) {
    this.commit((d) => {
      d.assets = d.assets.filter((a) => !(a.teamId === teamId && a.kind === kind));
    });
  }

  // ---- 提出・確認 ----
  async submit(teamId: string) {
    const t = this.team(teamId);
    if (!t || !["not_started", "in_progress", "returned"].includes(t.status)) throw new Error("締切を過ぎているか、すでに提出済みのため提出できません。");
    this.commit((d) => {
      d.teams = d.teams.map((x) => (x.id === teamId ? { ...x, status: "submitted", submittedAt: now() } : x));
      this.comment(d, teamId, "submit", "");
    });
  }
  async review(teamId: string, action: "approve" | "return" | "confirm", body: string) {
    const t = this.team(teamId);
    if (!t) throw new Error("チームが見つかりません。");
    const office = this.actingRole === "office";
    const oneStep = this.tournament().reviewFlow === "one_step";
    let next: Team["status"];
    if (action === "approve") {
      if (t.status !== "submitted") throw new Error("提出済みのチームだけ承認できます。");
      if (oneStep && !office) throw new Error("このチームを確認する権限がありません。");
      next = oneStep ? "office_confirmed" : "region_approved";
    } else if (action === "return") {
      if (!["submitted", "region_approved", "office_confirmed"].includes(t.status)) throw new Error("提出済みのチームだけ差し戻せます。");
      if (!office && t.status !== "submitted") throw new Error("地区承認後の差し戻しは事務局が行います。");
      if (!body.trim()) throw new Error("差し戻しの理由を入力してください。");
      next = "returned";
    } else {
      if (!office) throw new Error("事務局確認は事務局だけが行えます。");
      if (t.status !== "region_approved") throw new Error("地区承認済みのチームだけ確認できます。");
      next = "office_confirmed";
    }
    this.commit((d) => {
      d.teams = d.teams.map((x) => (x.id === teamId ? { ...x, status: next } : x));
      this.comment(d, teamId, action, body);
    });
  }
  async unlock(teamId: string, untilIso: string | null, reason: string) {
    if (untilIso && !reason.trim()) throw new Error("解除の理由を入力してください。");
    this.commit((d) => {
      d.teams = d.teams.map((x) => (x.id === teamId ? { ...x, unlockedUntil: untilIso } : x));
      this.comment(d, teamId, "unlock", untilIso ? `${untilIso.slice(0, 16).replace("T", " ")} までロック解除：${reason}` : "ロック解除を取り消し");
    });
  }
  async setPaperStatus(teamId: string, status: Team["paperStatus"]) {
    this.commit((d) => {
      d.teams = d.teams.map((x) => (x.id === teamId ? { ...x, paperStatus: status } : x));
    });
  }
  async setRegistrationConfirmed(teamId: string, confirmed: boolean) {
    this.commit((d) => {
      d.teams = d.teams.map((x) => (x.id === teamId ? { ...x, registrationConfirmed: confirmed } : x));
    });
  }

  // ---- 事務局（主催者） ----
  async saveTournament(p: TournamentPatch) {
    if (!p.name.trim()) throw new Error("大会名を入力してください。");
    this.commit((d) => {
      d.tournaments = d.tournaments.map((t) =>
        t.id === d.currentTournamentId
          ? {
              ...t,
              name: p.name,
              shortName: p.shortName,
              features: p.features,
              settings: { ...t.settings, name: p.name, startDate: p.startDate, entryDeadlineAt: p.entryDeadlineAt, entryDeadline: p.entryDeadlineAt.slice(0, 10), limits: p.limits, fees: p.fees },
            }
          : t,
      );
    });
  }
  async addUniversity(name: string, kana: string, regionId: string, menDivisionId: string | null, womenDivisionId: string | null) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("大学名を入力してください。");
    const tid = this.db.currentTournamentId;
    const existing = this.db.universities.find((x) => x.name === trimmed);
    if (existing && this.db.tus.some((x) => x.tournamentId === tid && x.universityId === existing.id)) throw new Error("この大学はすでに登録されています。");
    this.commit((d) => {
      let u = d.universities.find((x) => x.name === trimmed);
      if (!u) {
        u = { id: newId(), name: trimmed, kana: kana.trim() };
        d.universities.push(u);
      }
      d.tus.push({ tournamentId: tid, universityId: u.id, regionId, menDivisionId, womenDivisionId });
    });
  }
  async setUniversityDivision(universityId: string, gender: Gender, divisionId: string | null) {
    this.commit((d) => {
      const tid = d.currentTournamentId;
      d.tus = d.tus.map((x) =>
        x.tournamentId === tid && x.universityId === universityId ? { ...x, [gender === "men" ? "menDivisionId" : "womenDivisionId"]: divisionId } : x,
      );
      d.teams = d.teams.map((t) => (t.tournamentId === tid && t.universityId === universityId && t.gender === gender ? { ...t, divisionId } : t));
    });
  }
  async addMembership(m: NewMembership) {
    const email = m.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("メールアドレスの形式が正しくありません。");
    this.commit((d) => {
      d.memberships.push({ id: newId(), tournamentId: d.currentTournamentId, email, role: m.role, universityId: m.universityId, regionId: m.regionId, displayName: m.displayName, invitedAt: null });
    });
  }
  async removeMembership(id: string) {
    this.commit((d) => {
      d.memberships = d.memberships.filter((x) => x.id !== id);
    });
  }
  async sendLoginLink(email: string) {
    this.commit((d) => {
      d.memberships = d.memberships.map((x) => (x.email === email && x.tournamentId === d.currentTournamentId ? { ...x, invitedAt: now() } : x));
    });
  }
  async refresh() {}
  async signOut() {}

  async reset() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
    await new Promise<void>((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      } catch {
        resolve();
      }
    });
    this.db = seed();
    this.setSnapshot(this.view());
  }
}
