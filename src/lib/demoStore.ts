"use client";
// デモ版のデータ保存先。入力内容はブラウザの中だけ（データ＝localStorage、写真＝IndexedDB）に保存します。
// 本番（Supabase）と同じ動きになるよう、提出・承認・差し戻しのルールもここでまねています。

import { DEFAULT_SETTINGS } from "./settings";
import { BaseStore, emptySnapshot, type DataStore, type NewMembership, type Snapshot } from "./store";
import type { AssetKind, Gender, Member, Membership, Role, Team, Uniform } from "./types";
import { emptyMember } from "./types";

const LS_KEY = "handball-entry-demo-v2";
const DB_NAME = "handball-entry-demo-photos";
const DEMO_EMAIL = "demo@example.com";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

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
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("photos", mode);
    const req = fn(tx.objectStore("photos"));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

// ---- サンプルデータ ----
function blankTeam(id: string, universityId: string, gender: Gender, regionId: string, name: string): Team {
  return {
    id,
    tournamentId: "demo",
    universityId,
    gender,
    regionId,
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

const SURNAMES = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本", "井上"];
const GIVEN = ["翔太", "大輝", "拓海", "蓮", "陽斗", "悠真", "健太", "颯", "湊", "大和", "陸", "海斗", "優斗", "蒼", "樹", "隼"];
const KANA_S = ["さとう", "すずき", "たかはし", "たなか", "いとう", "わたなべ", "やまもと", "なかむら", "こばやし", "かとう", "よしだ", "やまだ", "ささき", "やまぐち", "まつもと", "いのうえ"];
const KANA_G = ["しょうた", "だいき", "たくみ", "れん", "はると", "ゆうま", "けんた", "はやて", "みなと", "やまと", "りく", "かいと", "ゆうと", "あおい", "いつき", "しゅん"];
const POS = ["GK", "LW", "LB", "CB", "RB", "RW", "PV", "CB", "LB", "RB", "GK", "PV", "LW", "RW", "CB", "LB"];

/** 入力がそろった架空のチームを作る */
function fullRoster(teamId: string, n: number, seed: number): Member[] {
  const t = now();
  const staff: Member = { ...emptyMember(teamId, "staff"), id: newId(), name: "監督 一郎", kana: "かんとく いちろう", birthDate: "1978-05-01", title: "監督", bench: true, photoConsent: false, updatedAt: t };
  const players = Array.from({ length: n }, (_, i): Member => {
    const k = (i + seed) % 16;
    return {
      ...emptyMember(teamId, "player"),
      id: newId(),
      name: `${SURNAMES[k]} ${GIVEN[(k * 7 + seed) % 16]}`,
      kana: `${KANA_S[k]} ${KANA_G[(k * 7 + seed) % 16]}`,
      birthDate: `200${3 + (i % 4)}-0${1 + (i % 9)}-1${i % 9}`,
      number: i + 1,
      grade: 1 + (i % 4),
      faculty: ["教育学部", "経済学部", "工学部", "文学部"][i % 4],
      position: POS[i % 16],
      highSchool: ["宮城県立青葉高校", "岩手県立北上高校", "秋田県立雄物高校", "福島県立会津高校"][i % 4],
      heightCm: 168 + ((i * 3) % 22),
      weightKg: 62 + ((i * 5) % 25),
      handedness: i % 5 === 0 ? "左" : "右",
      bench: i < 16,
      photoConsent: false,
      updatedAt: t,
    };
  });
  return [staff, ...players];
}

function fullUniforms(teamId: string): Uniform[] {
  return [
    { id: newId(), teamId, use: "CP", color: "紺", tone: "dark", sponsor: false },
    { id: newId(), teamId, use: "CP", color: "白", tone: "light", sponsor: false },
    { id: newId(), teamId, use: "GK", color: "黒", tone: "dark", sponsor: false },
    { id: newId(), teamId, use: "GK", color: "黄", tone: "light", sponsor: false },
  ];
}

function seed(): Snapshot {
  const t = now();
  const s = emptySnapshot();
  s.tournamentId = "demo";
  s.settings = DEFAULT_SETTINGS;
  s.email = DEMO_EMAIL;
  s.regions = [
    ["hokkaido", "北海道"], ["tohoku", "東北"], ["kanto", "関東"], ["hokushinetsu", "北信越"],
    ["tokai", "東海"], ["kansai", "関西"], ["chushikoku", "中四国"], ["kyushu", "九州"],
  ].map(([id, name], i) => ({ id, code: id, name, sortOrder: i + 1 }));
  s.universities = [
    { id: "u-sample", name: "サンプル大学", kana: "サンプルダイガク" },
    { id: "u-mori", name: "杜の都大学", kana: "モリノミヤコダイガク" },
    { id: "u-kita", name: "北上川大学", kana: "キタカミガワダイガク" },
    { id: "u-musa", name: "武蔵野テスト大学", kana: "ムサシノテストダイガク" },
  ];
  s.tournamentUniversities = [
    { universityId: "u-sample", regionId: "tohoku" },
    { universityId: "u-mori", regionId: "tohoku" },
    { universityId: "u-kita", regionId: "tohoku" },
    { universityId: "u-musa", regionId: "kanto" },
  ];
  const mk = (role: Role, universityId: string | null, regionId: string | null, email = DEMO_EMAIL, displayName = "デモ 利用者"): Membership => ({
    id: newId(), email, role, universityId, regionId, displayName, invitedAt: t,
  });
  s.myMemberships = [mk("team", "u-sample", null), mk("region", null, "tohoku"), mk("office", null, null)];
  s.allMemberships = [
    ...s.myMemberships,
    mk("team", "u-mori", null, "mori-handball@example.com", "杜の都大学 主務"),
    mk("team", "u-kita", null, "kitakami@example.com", "北上川大学 顧問"),
    mk("team", "u-musa", null, "musashino@example.com", "武蔵野テスト大学 主務"),
    mk("region", null, "kanto", "kanto-gakuren@example.com", "関東学連 担当"),
  ];

  // サンプル大学 男子（入力中）：M1と同じ
  const sample = { ...blankTeam(newId(), "u-sample", "men", "tohoku", "サンプル大学"), status: "in_progress" as const };
  const staffId = newId();
  sample.escort = { name: "宮城 正樹", title: "教授（部長）", qualified: true, staffMemberId: staffId };
  const samplePlayers: Partial<Member>[] = [
    { name: "東北 一郎", kana: "とうほく いちろう", number: 1, position: "GK", grade: 4, faculty: "教育学部", highSchool: "宮城県立青葉高校", heightCm: 185, weightKg: 82, handedness: "右", birthDate: "2005-06-12", bench: true },
    { name: "仙台 健太", kana: "せんだい けんた", number: 7, position: "CB", grade: 3, faculty: "経済学部", highSchool: "仙台市立杜の都高校", heightCm: 178, weightKg: 74, handedness: "右", birthDate: "2006-02-03", bench: true },
    { name: "青葉 翔", kana: "あおば しょう", number: 10, position: "LB", grade: 2, faculty: "スポーツ科学部", highSchool: "山形県立最上高校", heightCm: 188, weightKg: 85, handedness: "右", birthDate: "2007-09-20", bench: true },
    { name: "広瀬 蓮", kana: "ひろせ れん", number: 11, position: "RW", grade: 1, faculty: "工学部", highSchool: "福島県立阿武隈高校", heightCm: 172, weightKg: 66, handedness: "左", birthDate: "2009-12-24", bench: false },
  ];
  const sampleMembers: Member[] = [
    { ...emptyMember(sample.id, "staff"), id: staffId, name: "宮城 正樹", kana: "みやぎ まさき", birthDate: "1975-04-10", title: "部長", bench: true, photoConsent: false, updatedAt: t },
    ...samplePlayers.map((p) => ({ ...emptyMember(sample.id, "player"), ...p, id: newId(), photoConsent: true, updatedAt: t })),
    { ...emptyMember(sample.id, "player"), id: newId(), name: "名取 大地", kana: "なとり だいち", isEntry: false, updatedAt: t },
  ];

  // 杜の都大学 男子（提出済）・北上川大学 女子（差し戻し）・武蔵野テスト大学 男子（地区承認済）
  const filled = (team: Team, n: number, seedNo: number) => {
    team.contactName = "主務 花子";
    team.contactPhone = "022-000-0000";
    team.contactEmail = "contact@example.com";
    team.jhaNumber = "0400" + seedNo;
    team.studentFedNumber = "R9-" + seedNo;
    const ms = fullRoster(team.id, n, seedNo);
    team.escort = { name: ms[0].name, title: "准教授", qualified: true, staffMemberId: ms[0].id };
    return ms;
  };
  const mori = { ...blankTeam(newId(), "u-mori", "men", "tohoku", "杜の都大学"), status: "submitted" as const, submittedAt: t };
  const kita = { ...blankTeam(newId(), "u-kita", "women", "tohoku", "北上川大学"), status: "returned" as const, submittedAt: t };
  const musa = { ...blankTeam(newId(), "u-musa", "men", "kanto", "武蔵野テスト大学"), status: "region_approved" as const, submittedAt: t, paperStatus: "received" as const };
  const moriMembers = filled(mori, 20, 1);
  const kitaMembers = filled(kita, 14, 5);
  const musaMembers = filled(musa, 22, 9);

  s.teams = [sample, mori, kita, musa];
  s.members = [...sampleMembers, ...moriMembers, ...kitaMembers, ...musaMembers];
  s.uniforms = [...fullUniforms(mori.id), ...fullUniforms(kita.id), ...fullUniforms(musa.id)];
  s.comments = [
    { id: newId(), teamId: mori.id, authorEmail: "mori-handball@example.com", authorRole: "team", action: "submit", body: "", createdAt: t },
    { id: newId(), teamId: kita.id, authorEmail: "kitakami@example.com", authorRole: "team", action: "submit", body: "", createdAt: t },
    { id: newId(), teamId: kita.id, authorEmail: "tohoku-gakuren@example.com", authorRole: "region", action: "return", body: "背番号3番の選手の出身高校が空欄です。入力して再提出してください。", createdAt: t },
    { id: newId(), teamId: musa.id, authorEmail: "musashino@example.com", authorRole: "team", action: "submit", body: "", createdAt: t },
    { id: newId(), teamId: musa.id, authorEmail: "kanto-gakuren@example.com", authorRole: "region", action: "approve", body: "", createdAt: t },
  ];
  kitaMembers[3].highSchool = "";
  return s;
}

export class DemoStore extends BaseStore implements DataStore {
  readonly mode = "demo" as const;
  /** デモで今どの役割として操作しているか（コメントの記録に使う） */
  actingRole: Role = "team";

  constructor() {
    super();
    this.snap = this.load();
  }

  private load(): Snapshot {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return { ...emptySnapshot(), ...(JSON.parse(raw) as Snapshot), settings: DEFAULT_SETTINGS };
    } catch {
      /* 読めなければサンプルから */
    }
    return seed();
  }
  private commit(mutate: (s: Snapshot) => void) {
    const next = structuredClone(this.snap);
    mutate(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* 保存できなくても画面は動かす */
    }
    this.setSnapshot(next);
  }
  private touchTeam(s: Snapshot, teamId: string) {
    s.teams = s.teams.map((t) => (t.id === teamId ? { ...t, status: t.status === "not_started" ? "in_progress" : t.status, updatedAt: now() } : t));
  }
  private comment(s: Snapshot, teamId: string, action: Snapshot["comments"][number]["action"], body: string) {
    s.comments.push({ id: newId(), teamId, authorEmail: DEMO_EMAIL, authorRole: this.actingRole, action, body, createdAt: now() });
  }

  async createTeam(universityId: string, gender: Gender) {
    const existing = this.snap.teams.find((t) => t.universityId === universityId && t.gender === gender);
    if (existing) return existing;
    const tu = this.snap.tournamentUniversities.find((x) => x.universityId === universityId);
    if (!tu) throw new Error("この大学は今年度の参加大学として登録されていません。");
    const team = blankTeam(newId(), universityId, gender, tu.regionId, this.university(universityId)?.name ?? "");
    this.commit((s) => s.teams.push(team));
    return team;
  }
  async saveTeam(team: Team) {
    this.commit((s) => {
      s.teams = s.teams.map((t) => (t.id === team.id ? { ...team, status: t.status, unlockedUntil: t.unlockedUntil, submittedAt: t.submittedAt, paperStatus: t.paperStatus, registrationConfirmed: t.registrationConfirmed } : t));
      this.touchTeam(s, team.id);
    });
  }
  async saveMember(member: Member) {
    const m = { ...member, id: member.id || newId(), updatedAt: now() };
    this.commit((s) => {
      const exists = s.members.some((x) => x.id === m.id);
      s.members = exists ? s.members.map((x) => (x.id === m.id ? m : x)) : [...s.members, m];
      this.touchTeam(s, m.teamId);
    });
    return m;
  }
  async deleteMember(id: string) {
    const m = this.member(id);
    if (m?.photoKey) await idb("readwrite", (st) => st.delete(m.photoKey!)).catch(() => {});
    this.commit((s) => {
      s.members = s.members.filter((x) => x.id !== id);
      s.teams = s.teams.map((t) => (t.escort.staffMemberId === id ? { ...t, escort: { ...t.escort, staffMemberId: null } } : t));
    });
  }
  async saveUniforms(teamId: string, uniforms: Uniform[]) {
    this.commit((s) => {
      s.uniforms = [...s.uniforms.filter((u) => u.teamId !== teamId), ...uniforms.map((u) => ({ ...u, id: u.id || newId(), teamId }))];
      this.touchTeam(s, teamId);
    });
  }
  async putPhoto(_teamId: string, blob: Blob) {
    const key = newId();
    await idb("readwrite", (st) => st.put(blob, key));
    return key;
  }
  protected async fetchPhoto(path: string) {
    return idb<Blob | undefined>("readonly", (st) => st.get(path));
  }
  async setAsset(teamId: string, kind: AssetKind, blob: Blob, width: number, height: number) {
    const path = await this.putPhoto(teamId, blob);
    this.commit((s) => {
      s.assets = [...s.assets.filter((a) => !(a.teamId === teamId && a.kind === kind)), { id: newId(), teamId, kind, path, width, height }];
      this.touchTeam(s, teamId);
    });
  }
  async removeAsset(teamId: string, kind: AssetKind) {
    this.commit((s) => {
      s.assets = s.assets.filter((a) => !(a.teamId === teamId && a.kind === kind));
    });
  }

  async submit(teamId: string) {
    const t = this.team(teamId);
    if (!t || !["not_started", "in_progress", "returned"].includes(t.status)) throw new Error("締切を過ぎているか、すでに提出済みのため提出できません。");
    this.commit((s) => {
      s.teams = s.teams.map((x) => (x.id === teamId ? { ...x, status: "submitted", submittedAt: now() } : x));
      this.comment(s, teamId, "submit", "");
    });
  }
  async review(teamId: string, action: "approve" | "return" | "confirm", body: string) {
    const t = this.team(teamId);
    if (!t) throw new Error("チームが見つかりません。");
    const office = this.actingRole === "office";
    let next: Team["status"];
    if (action === "approve") {
      if (t.status !== "submitted") throw new Error("提出済みのチームだけ承認できます。");
      next = "region_approved";
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
    this.commit((s) => {
      s.teams = s.teams.map((x) => (x.id === teamId ? { ...x, status: next } : x));
      this.comment(s, teamId, action, body);
    });
  }
  async unlock(teamId: string, untilIso: string | null, reason: string) {
    if (untilIso && !reason.trim()) throw new Error("解除の理由を入力してください。");
    this.commit((s) => {
      s.teams = s.teams.map((x) => (x.id === teamId ? { ...x, unlockedUntil: untilIso } : x));
      this.comment(s, teamId, "unlock", untilIso ? `${untilIso.slice(0, 16).replace("T", " ")} までロック解除：${reason}` : "ロック解除を取り消し");
    });
  }
  async setPaperStatus(teamId: string, status: Team["paperStatus"]) {
    this.commit((s) => {
      s.teams = s.teams.map((x) => (x.id === teamId ? { ...x, paperStatus: status } : x));
    });
  }
  async setRegistrationConfirmed(teamId: string, confirmed: boolean) {
    this.commit((s) => {
      s.teams = s.teams.map((x) => (x.id === teamId ? { ...x, registrationConfirmed: confirmed } : x));
    });
  }

  async addUniversity(name: string, kana: string, regionId: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("大学名を入力してください。");
    this.commit((s) => {
      let u = s.universities.find((x) => x.name === trimmed);
      if (!u) {
        u = { id: newId(), name: trimmed, kana: kana.trim() };
        s.universities.push(u);
      }
      const id = u.id;
      if (s.tournamentUniversities.some((x) => x.universityId === id)) throw new Error("この大学はすでに登録されています。");
      s.tournamentUniversities.push({ universityId: id, regionId });
    });
  }
  async addMembership(m: NewMembership) {
    const email = m.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("メールアドレスの形式が正しくありません。");
    this.commit((s) => {
      s.allMemberships.push({ id: newId(), email, role: m.role, universityId: m.universityId, regionId: m.regionId, displayName: m.displayName, invitedAt: null });
    });
  }
  async removeMembership(id: string) {
    this.commit((s) => {
      s.allMemberships = s.allMemberships.filter((x) => x.id !== id);
    });
  }
  async sendLoginLink(email: string) {
    this.commit((s) => {
      s.allMemberships = s.allMemberships.map((x) => (x.email === email ? { ...x, invitedAt: now() } : x));
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
    this.setSnapshot(seed());
  }
}
