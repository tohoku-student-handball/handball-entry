"use client";
// データの保存先。
// M1試作品：ブラウザ内（データ＝localStorage、写真＝IndexedDB）に保存する「お試し用」。
// M2以降：同じ DataStore の形のまま、Supabase に保存する実装に差し替える。

import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS } from "./settings";
import type { Gender, Member, Region, Team, TournamentSettings, University } from "./types";
import { emptyMember } from "./types";

export interface DataStore {
  settings(): TournamentSettings;
  university(): University;
  region(id: string): Region | undefined;
  teams(): Team[];
  team(id: string): Team | undefined;
  createTeam(gender: Gender): Team;
  saveTeam(team: Team): void;
  members(teamId: string): Member[];
  member(id: string): Member | undefined;
  saveMember(member: Member): Member;
  deleteMember(id: string): Promise<void>;
  putPhoto(blob: Blob): Promise<string>;
  getPhoto(key: string): Promise<Blob | undefined>;
  reset(): Promise<void>;
}

interface Snapshot {
  version: 1;
  university: University;
  regions: Region[];
  teams: Team[];
  members: Member[];
}

const LS_KEY = "handball-entry-demo-v1";
const DB_NAME = "handball-entry-demo-photos";

function now() {
  return new Date().toISOString();
}
function newId() {
  return crypto.randomUUID();
}

function seed(): Snapshot {
  const t = now();
  const teamId = newId();
  const staffId = newId();
  const players: Partial<Member>[] = [
    { name: "東北 一郎", kana: "とうほく いちろう", number: 1, position: "GK", grade: 4, faculty: "教育学部", highSchool: "宮城県立青葉高校", heightCm: 185, weightKg: 82, handedness: "右", birthDate: "2005-06-12", bench: true },
    { name: "仙台 健太", kana: "せんだい けんた", number: 7, position: "CB", grade: 3, faculty: "経済学部", highSchool: "仙台市立杜の都高校", heightCm: 178, weightKg: 74, handedness: "右", birthDate: "2006-02-03", bench: true },
    { name: "青葉 翔", kana: "あおば しょう", number: 10, position: "LB", grade: 2, faculty: "スポーツ科学部", highSchool: "山形県立最上高校", heightCm: 188, weightKg: 85, handedness: "右", birthDate: "2007-09-20", bench: true },
    { name: "広瀬 蓮", kana: "ひろせ れん", number: 11, position: "RW", grade: 1, faculty: "工学部", highSchool: "福島県立阿武隈高校", heightCm: 172, weightKg: 66, handedness: "左", birthDate: "2009-12-24", bench: false },
  ];
  const members: Member[] = [
    { ...emptyMember(teamId, "staff"), id: staffId, name: "宮城 正樹", kana: "みやぎ まさき", birthDate: "1975-04-10", title: "部長", bench: true, photoConsent: false, updatedAt: t },
    ...players.map((p) => ({ ...emptyMember(teamId, "player"), ...p, id: newId(), photoConsent: true, updatedAt: t })),
    { ...emptyMember(teamId, "player"), id: newId(), name: "名取 大地", kana: "なとり だいち", isEntry: false, updatedAt: t },
  ];
  return {
    version: 1,
    university: { id: "u-sample", name: "サンプル大学", kana: "サンプルダイガク" },
    regions: [
      { id: "hokkaido", name: "北海道" },
      { id: "tohoku", name: "東北" },
      { id: "kanto", name: "関東" },
      { id: "hokushinetsu", name: "北信越" },
      { id: "tokai", name: "東海" },
      { id: "kansai", name: "関西" },
      { id: "chushikoku", name: "中四国" },
      { id: "kyushu", name: "九州" },
    ],
    teams: [
      {
        id: teamId,
        universityId: "u-sample",
        gender: "men",
        regionId: "tohoku",
        status: "in_progress",
        displayName: "サンプル大学",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        jhaNumber: "",
        studentFedNumber: "",
        escort: { name: "宮城 正樹", title: "教授（部長）", qualified: true, staffMemberId: staffId },
        comment: "",
        updatedAt: t,
      },
    ],
    members,
  };
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
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("photos", mode);
    const req = fn(tx.objectStore("photos"));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

class LocalStore implements DataStore {
  private snap: Snapshot;
  private listeners = new Set<() => void>();
  version = 0;

  constructor() {
    this.snap = this.load();
  }

  private load(): Snapshot {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Snapshot;
        if (s.version === 1) return s;
      }
    } catch {
      /* 読めなければ初期データ */
    }
    return seed();
  }
  private commit() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.snap));
    } catch {
      /* プライベートモード等で保存できなくても、画面は動かす */
    }
    this.version++;
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  settings() {
    return DEFAULT_SETTINGS;
  }
  university() {
    return this.snap.university;
  }
  region(id: string) {
    return this.snap.regions.find((r) => r.id === id);
  }
  teams() {
    return this.snap.teams;
  }
  team(id: string) {
    return this.snap.teams.find((t) => t.id === id);
  }
  createTeam(gender: Gender): Team {
    const existing = this.snap.teams.find((t) => t.gender === gender);
    if (existing) return existing;
    const t: Team = {
      id: newId(),
      universityId: this.snap.university.id,
      gender,
      regionId: this.snap.teams[0]?.regionId ?? "tohoku",
      status: "not_started",
      displayName: this.snap.university.name,
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      jhaNumber: "",
      studentFedNumber: "",
      escort: { name: "", title: "", qualified: false, staffMemberId: null },
      comment: "",
      updatedAt: now(),
    };
    this.snap.teams = [...this.snap.teams, t];
    this.commit();
    return t;
  }
  saveTeam(team: Team) {
    const t = { ...team, updatedAt: now(), status: team.status === "not_started" ? "in_progress" : team.status } as Team;
    this.snap.teams = this.snap.teams.map((x) => (x.id === t.id ? t : x));
    this.commit();
  }
  members(teamId: string) {
    return this.snap.members.filter((m) => m.teamId === teamId);
  }
  member(id: string) {
    return this.snap.members.find((m) => m.id === id);
  }
  saveMember(member: Member): Member {
    const m = { ...member, id: member.id || newId(), updatedAt: now() };
    const exists = this.snap.members.some((x) => x.id === m.id);
    this.snap.members = exists ? this.snap.members.map((x) => (x.id === m.id ? m : x)) : [...this.snap.members, m];
    this.snap.teams = this.snap.teams.map((t) =>
      t.id === m.teamId && t.status === "not_started" ? { ...t, status: "in_progress" } : t,
    );
    this.commit();
    return m;
  }
  async deleteMember(id: string) {
    const m = this.member(id);
    if (m?.photoKey) await idb("readwrite", (s) => s.delete(m.photoKey!)).catch(() => {});
    this.snap.members = this.snap.members.filter((x) => x.id !== id);
    this.snap.teams = this.snap.teams.map((t) =>
      t.escort.staffMemberId === id ? { ...t, escort: { ...t.escort, staffMemberId: null } } : t,
    );
    this.commit();
  }
  async putPhoto(blob: Blob) {
    const key = newId();
    await idb("readwrite", (s) => s.put(blob, key));
    return key;
  }
  async getPhoto(key: string) {
    return idb<Blob | undefined>("readonly", (s) => s.get(key)).catch(() => undefined);
  }
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
    this.snap = seed();
    this.commit();
  }
}

let instance: LocalStore | null = null;
export function getStore(): LocalStore {
  if (!instance) instance = new LocalStore();
  return instance;
}

/** データが変わるたびに画面を描き直すためのフック */
export function useStore(): DataStore {
  const store = getStore();
  useSyncExternalStore(store.subscribe, () => store.version, () => 0);
  return store;
}

/** 写真キーから表示用URLを作る */
export function usePhotoUrl(key: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }
    let revoked = false;
    let u: string | null = null;
    getStore()
      .getPhoto(key)
      .then((b) => {
        if (b && !revoked) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      });
    return () => {
      revoked = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [key]);
  return url;
}
