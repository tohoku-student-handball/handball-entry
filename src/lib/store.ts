"use client";
// データの保存先の「窓口」。画面はこの DataStore だけを使います。
//   デモ版（demoStore.ts）：ブラウザの中だけに保存。試作品・説明用。
//   本番（liveStore.ts）  ：Supabase に保存。
// 読み出しはすぐに返り（手元に持っている写しから）、書き込みは Promise で返ります。
//
// 部員の情報は「年度の部員名簿（roster）」、大会ごとの背番号などは「エントリー（entries）」に分けて持ち、
// 画面とルール判定には members(teamId) で両方を合わせた形（Member）を渡します。

import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS } from "./settings";
import type {
  AssetKind,
  Division,
  Entry,
  Features,
  Gender,
  Member,
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
import { ALL_FEATURES, toMember } from "./types";

export interface Snapshot {
  /** 自分が関わっている大会の一覧 */
  tournaments: TournamentInfo[];
  /** いま開いている大会 */
  tournamentId: string;
  settings: TournamentSettings;
  email: string;
  /** いま開いている大会での自分の所属 */
  myMemberships: Membership[];
  /** 事務局のみ：いま開いている大会の全員の所属 */
  allMemberships: Membership[];
  regions: Region[];
  divisions: Division[];
  universities: University[];
  tournamentUniversities: TournamentUniversity[];
  teams: Team[];
  /** 見られる大学の、いま開いている大会の年度の部員名簿 */
  roster: RosterPerson[];
  entries: Entry[];
  uniforms: Uniform[];
  assets: TeamAsset[];
  comments: ReviewComment[];
}

export function emptySnapshot(): Snapshot {
  return {
    tournaments: [],
    tournamentId: "",
    settings: DEFAULT_SETTINGS,
    email: "",
    myMemberships: [],
    allMemberships: [],
    regions: [],
    divisions: [],
    universities: [],
    tournamentUniversities: [],
    teams: [],
    roster: [],
    entries: [],
    uniforms: [],
    assets: [],
    comments: [],
  };
}

export interface NewMembership {
  email: string;
  role: Role;
  universityId: string | null;
  regionId: string | null;
  displayName: string;
}

/** 大会の設定画面で変更できる項目 */
export interface TournamentPatch {
  name: string;
  shortName: string;
  startDate: string;
  entryDeadlineAt: string;
  limits: TournamentSettings["limits"];
  fees: TournamentSettings["fees"];
  features: Features;
}

export interface DataStore {
  readonly mode: "demo" | "live";
  version: number;
  subscribe(listener: () => void): () => void;

  // ---- 読み出し ----
  snapshot(): Snapshot;
  tournaments(): TournamentInfo[];
  tournament(): TournamentInfo;
  features(): Features;
  settings(): TournamentSettings;
  email(): string;
  myRoles(): Role[];
  myMemberships(): Membership[];
  allMemberships(): Membership[];
  regions(): Region[];
  region(id: string): Region | undefined;
  divisions(gender?: Gender): Division[];
  division(id: string | null): Division | undefined;
  universities(): University[];
  university(id: string): University | undefined;
  tournamentUniversities(): TournamentUniversity[];
  teams(): Team[];
  team(id: string): Team | undefined;
  /** 部員名簿（いま開いている大会の年度）。active=false の人も含む */
  roster(universityId: string, gender: Gender): RosterPerson[];
  person(id: string): RosterPerson | undefined;
  entries(teamId: string): Entry[];
  /** 名簿とエントリーを合わせた、そのチームのエントリー一覧 */
  members(teamId: string): Member[];
  member(entryId: string): Member | undefined;
  uniforms(teamId: string): Uniform[];
  assets(teamId: string): TeamAsset[];
  comments(teamId: string): ReviewComment[];

  // ---- 大会の切り替え ----
  selectTournament(id: string): Promise<void>;

  // ---- 部員名簿 ----
  savePerson(person: RosterPerson): Promise<RosterPerson>;
  /** どの大会にもエントリーしていなければ削除、していれば名簿から外す（active=false） */
  removePerson(id: string): Promise<void>;
  putPersonPhoto(universityId: string, blob: Blob): Promise<string>;

  // ---- チームの入力 ----
  createTeam(universityId: string, gender: Gender): Promise<Team>;
  saveTeam(team: Team): Promise<void>;
  /** そのチームのエントリーをまとめて保存（渡したものだけが残る） */
  saveEntries(teamId: string, entries: Entry[]): Promise<void>;
  saveUniforms(teamId: string, uniforms: Uniform[]): Promise<void>;
  getPhoto(path: string): Promise<Blob | undefined>;
  setAsset(teamId: string, kind: AssetKind, blob: Blob, width: number, height: number): Promise<void>;
  removeAsset(teamId: string, kind: AssetKind): Promise<void>;

  // ---- 提出・確認 ----
  submit(teamId: string): Promise<void>;
  review(teamId: string, action: "approve" | "return" | "confirm", comment: string): Promise<void>;
  unlock(teamId: string, untilIso: string | null, reason: string): Promise<void>;
  setPaperStatus(teamId: string, status: Team["paperStatus"]): Promise<void>;
  setRegistrationConfirmed(teamId: string, confirmed: boolean): Promise<void>;

  // ---- 事務局（主催者） ----
  saveTournament(patch: TournamentPatch): Promise<void>;
  addUniversity(name: string, kana: string, regionId: string, menDivisionId: string | null, womenDivisionId: string | null): Promise<void>;
  setUniversityDivision(universityId: string, gender: Gender, divisionId: string | null): Promise<void>;
  addMembership(m: NewMembership): Promise<void>;
  removeMembership(id: string): Promise<void>;
  sendLoginLink(email: string): Promise<void>;

  // ---- その他 ----
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const EMPTY_TOURNAMENT: TournamentInfo = {
  id: "",
  name: "",
  shortName: "",
  kind: "national",
  academicYear: 0,
  season: "",
  organizer: "",
  reviewFlow: "two_step",
  features: ALL_FEATURES,
};

/** 読み出しの共通部分（写しを持ち、変わったら画面に知らせる） */
export abstract class BaseStore {
  protected snap: Snapshot = emptySnapshot();
  private listeners = new Set<() => void>();
  version = 0;
  private photoCache = new Map<string, Promise<Blob | undefined>>();

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  protected emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  protected setSnapshot(s: Snapshot) {
    this.snap = s;
    this.emit();
  }

  snapshot() {
    return this.snap;
  }
  tournaments() {
    return this.snap.tournaments;
  }
  tournament(): TournamentInfo {
    return this.snap.tournaments.find((t) => t.id === this.snap.tournamentId) ?? EMPTY_TOURNAMENT;
  }
  features(): Features {
    return this.tournament().features;
  }
  settings() {
    return this.snap.settings;
  }
  email() {
    return this.snap.email;
  }
  myMemberships() {
    return this.snap.myMemberships;
  }
  myRoles(): Role[] {
    const order: Role[] = ["team", "region", "office", "scorer", "agency"];
    return order.filter((r) => this.snap.myMemberships.some((m) => m.role === r));
  }
  allMemberships() {
    return this.snap.allMemberships;
  }
  regions() {
    return [...this.snap.regions].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  region(id: string) {
    return this.snap.regions.find((r) => r.id === id);
  }
  divisions(gender?: Gender) {
    return this.snap.divisions.filter((d) => !gender || d.gender === gender).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  division(id: string | null) {
    return id ? this.snap.divisions.find((d) => d.id === id) : undefined;
  }
  universities() {
    return this.snap.universities;
  }
  university(id: string) {
    return this.snap.universities.find((u) => u.id === id);
  }
  tournamentUniversities() {
    return this.snap.tournamentUniversities;
  }
  teams() {
    return this.snap.teams;
  }
  team(id: string) {
    return this.snap.teams.find((t) => t.id === id);
  }
  roster(universityId: string, gender: Gender) {
    return this.snap.roster.filter((p) => p.universityId === universityId && p.gender === gender);
  }
  person(id: string) {
    return this.snap.roster.find((p) => p.id === id);
  }
  entries(teamId: string) {
    return this.snap.entries.filter((e) => e.teamId === teamId);
  }
  members(teamId: string): Member[] {
    const byId = new Map(this.snap.roster.map((p) => [p.id, p]));
    return this.entries(teamId).flatMap((e) => {
      const p = byId.get(e.personId);
      return p ? [toMember(p, e)] : [];
    });
  }
  member(entryId: string) {
    const e = this.snap.entries.find((x) => x.id === entryId);
    const p = e && this.person(e.personId);
    return e && p ? toMember(p, e) : undefined;
  }
  uniforms(teamId: string) {
    return this.snap.uniforms.filter((u) => u.teamId === teamId);
  }
  assets(teamId: string) {
    return this.snap.assets.filter((a) => a.teamId === teamId);
  }
  comments(teamId: string) {
    return this.snap.comments.filter((c) => c.teamId === teamId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** 写真の読み出し（同じ写真は1回だけ取りに行く） */
  getPhoto(path: string): Promise<Blob | undefined> {
    let p = this.photoCache.get(path);
    if (!p) {
      p = this.fetchPhoto(path).catch(() => undefined);
      this.photoCache.set(path, p);
    }
    return p;
  }
  protected forgetPhoto(path: string) {
    this.photoCache.delete(path);
  }
  protected abstract fetchPhoto(path: string): Promise<Blob | undefined>;
}

// ---- 画面から使う入口 ----

let current: DataStore | null = null;

export function setStore(store: DataStore) {
  current = store;
}
export function getStore(): DataStore {
  if (!current) throw new Error("データの保存先が設定されていません");
  return current;
}

/** データが変わるたびに画面を描き直すためのフック */
export function useStore(): DataStore {
  const store = getStore();
  useSyncExternalStore(store.subscribe, () => store.version, () => 0);
  return store;
}

/** 写真の保存場所から表示用URLを作る */
export function usePhotoUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let u: string | null = null;
    getStore()
      .getPhoto(path)
      .then((b) => {
        if (b && !cancelled) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      });
    return () => {
      cancelled = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [path]);
  return url;
}

/** 保存時のエラーを、画面に出せる日本語にする */
export function toMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/permission denied for (table|schema|function|sequence)/i.test(msg))
    return `データベースの読み書きの許可が設定されていません。大会事務局にご連絡ください。（詳細：${msg}）`;
  if (/row-level security|permission denied|violates row-level/i.test(msg))
    return "保存できませんでした。締切を過ぎているか、この操作を行う権限がありません。";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "通信できませんでした。電波の良い場所で、もう一度お試しください。";
  if (/JWT|session|not authenticated/i.test(msg)) return "ログインの有効期限が切れました。もう一度ログインしてください。";
  return msg;
}
