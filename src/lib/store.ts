"use client";
// データの保存先の「窓口」。画面はこの DataStore だけを使います。
//   デモ版（demoStore.ts）：ブラウザの中だけに保存。試作品・説明用。
//   本番（liveStore.ts）  ：Supabase に保存。
// 読み出しはすぐに返り（手元に持っている写しから）、書き込みは Promise で返ります。

import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS } from "./settings";
import type {
  AssetKind,
  Gender,
  Member,
  Membership,
  Region,
  ReviewComment,
  Role,
  Team,
  TeamAsset,
  TournamentSettings,
  TournamentUniversity,
  Uniform,
  University,
} from "./types";

export interface Snapshot {
  tournamentId: string;
  settings: TournamentSettings;
  email: string;
  /** 自分の所属 */
  myMemberships: Membership[];
  /** 事務局のみ：全員の所属 */
  allMemberships: Membership[];
  regions: Region[];
  universities: University[];
  tournamentUniversities: TournamentUniversity[];
  teams: Team[];
  members: Member[];
  uniforms: Uniform[];
  assets: TeamAsset[];
  comments: ReviewComment[];
}

export function emptySnapshot(): Snapshot {
  return {
    tournamentId: "",
    settings: DEFAULT_SETTINGS,
    email: "",
    myMemberships: [],
    allMemberships: [],
    regions: [],
    universities: [],
    tournamentUniversities: [],
    teams: [],
    members: [],
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

export interface DataStore {
  readonly mode: "demo" | "live";
  version: number;
  subscribe(listener: () => void): () => void;

  // ---- 読み出し ----
  snapshot(): Snapshot;
  settings(): TournamentSettings;
  email(): string;
  myRoles(): Role[];
  myMemberships(): Membership[];
  allMemberships(): Membership[];
  regions(): Region[];
  region(id: string): Region | undefined;
  universities(): University[];
  university(id: string): University | undefined;
  tournamentUniversities(): TournamentUniversity[];
  teams(): Team[];
  team(id: string): Team | undefined;
  members(teamId: string): Member[];
  member(id: string): Member | undefined;
  uniforms(teamId: string): Uniform[];
  assets(teamId: string): TeamAsset[];
  comments(teamId: string): ReviewComment[];

  // ---- チームの入力 ----
  createTeam(universityId: string, gender: Gender): Promise<Team>;
  saveTeam(team: Team): Promise<void>;
  saveMember(member: Member): Promise<Member>;
  deleteMember(id: string): Promise<void>;
  saveUniforms(teamId: string, uniforms: Uniform[]): Promise<void>;
  putPhoto(teamId: string, blob: Blob): Promise<string>;
  getPhoto(path: string): Promise<Blob | undefined>;
  setAsset(teamId: string, kind: AssetKind, blob: Blob, width: number, height: number): Promise<void>;
  removeAsset(teamId: string, kind: AssetKind): Promise<void>;

  // ---- 提出・確認 ----
  submit(teamId: string): Promise<void>;
  review(teamId: string, action: "approve" | "return" | "confirm", comment: string): Promise<void>;
  unlock(teamId: string, untilIso: string | null, reason: string): Promise<void>;
  setPaperStatus(teamId: string, status: Team["paperStatus"]): Promise<void>;
  setRegistrationConfirmed(teamId: string, confirmed: boolean): Promise<void>;

  // ---- 事務局 ----
  addUniversity(name: string, kana: string, regionId: string): Promise<void>;
  addMembership(m: NewMembership): Promise<void>;
  removeMembership(id: string): Promise<void>;
  sendLoginLink(email: string): Promise<void>;

  // ---- その他 ----
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

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
    const order: Role[] = ["team", "region", "office", "agency"];
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
  members(teamId: string) {
    return this.snap.members.filter((m) => m.teamId === teamId);
  }
  member(id: string) {
    return this.snap.members.find((m) => m.id === id);
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
  if (/row-level security|permission denied|violates row-level/i.test(msg))
    return "保存できませんでした。締切を過ぎているか、この操作を行う権限がありません。";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "通信できませんでした。電波の良い場所で、もう一度お試しください。";
  if (/JWT|session|not authenticated/i.test(msg)) return "ログインの有効期限が切れました。もう一度ログインしてください。";
  return msg;
}
