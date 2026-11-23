"use client";
// 本番のデータ保存先（Supabase）。
// 誰が何を見られるかはデータベース側（supabase/schema.sql の RLS）で制限されているので、
// ここでは「見えるものを全部読み込む」だけでよい作りになっています。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS } from "./settings";
import { BaseStore, emptySnapshot, type DataStore, type NewMembership, type TournamentPatch } from "./store";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabaseConfig";
import type {
  AssetKind,
  Division,
  Entry,
  Features,
  Gender,
  Membership,
  Region,
  ReviewComment,
  RosterPerson,
  Team,
  TeamAsset,
  TournamentInfo,
  TournamentSettings,
  TournamentUniversity,
  Uniform,
} from "./types";
import { ALL_FEATURES } from "./types";

const BUCKET = "team-files";
const CURRENT_KEY = "handball-entry-current-tournament";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v as string) ?? "";
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// ---- データベースの列（snake_case）と画面の項目（camelCase）の変換 ----

const tournamentFromRow = (r: Row): TournamentInfo => ({
  id: str(r.id),
  name: str(r.name),
  shortName: str(r.short_name) || str(r.name),
  kind: r.kind as TournamentInfo["kind"],
  academicYear: Number(r.academic_year),
  season: (r.season as TournamentInfo["season"]) ?? "",
  organizer: str(r.organizer),
  reviewFlow: r.review_flow as TournamentInfo["reviewFlow"],
  features: { ...ALL_FEATURES, ...((r.features as Partial<Features>) ?? {}) },
});

/** 日本時間の日付（YYYY-MM-DD） */
function jstDate(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

const settingsFromRow = (r: Row): TournamentSettings => {
  const saved = (r.settings as Partial<TournamentSettings>) ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    limits: { ...DEFAULT_SETTINGS.limits, ...(saved.limits ?? {}) },
    fees: { ...DEFAULT_SETTINGS.fees, ...(saved.fees ?? {}) },
    name: str(r.name),
    startDate: str(r.start_date),
    entryDeadlineAt: str(r.entry_deadline),
    entryDeadline: jstDate(str(r.entry_deadline)),
  };
};

const teamFromRow = (r: Row): Team => ({
  id: str(r.id),
  tournamentId: str(r.tournament_id),
  universityId: str(r.university_id),
  gender: r.gender as Gender,
  regionId: str(r.region_id),
  divisionId: (r.division_id as string) ?? null,
  status: r.status as Team["status"],
  displayName: str(r.display_name),
  contactName: str(r.contact_name),
  contactPhone: str(r.contact_phone),
  contactEmail: str(r.contact_email),
  jhaNumber: str(r.jha_number),
  studentFedNumber: str(r.student_fed_number),
  escort: { name: "", title: "", qualified: false, staffMemberId: null, ...((r.escort as object) ?? {}) },
  comment: str(r.comment),
  registrationConfirmed: !!r.registration_confirmed,
  paperStatus: r.paper_status as Team["paperStatus"],
  unlockedUntil: (r.unlocked_until as string) ?? null,
  submittedAt: (r.submitted_at as string) ?? null,
  updatedAt: str(r.updated_at),
});
const teamToRow = (t: Team): Row => ({
  display_name: t.displayName,
  contact_name: t.contactName,
  contact_phone: t.contactPhone,
  contact_email: t.contactEmail,
  jha_number: t.jhaNumber,
  student_fed_number: t.studentFedNumber,
  escort: t.escort,
  comment: t.comment,
});

const personFromRow = (r: Row): RosterPerson => ({
  id: str(r.id),
  universityId: str(r.university_id),
  gender: r.gender as Gender,
  academicYear: Number(r.academic_year),
  kind: r.kind as RosterPerson["kind"],
  name: str(r.name),
  kana: str(r.kana),
  birthDate: str(r.birth_date),
  grade: num(r.grade),
  faculty: str(r.faculty),
  position: str(r.position),
  highSchool: str(r.high_school),
  heightCm: num(r.height_cm),
  weightKg: num(r.weight_kg),
  handedness: str(r.handedness),
  foreignStatus: r.foreign_status as RosterPerson["foreignStatus"],
  defaultTitle: str(r.default_title),
  isStudent: !!r.is_student,
  photoKey: (r.photo_path as string) ?? null,
  photoConsent: !!r.photo_consent,
  dopingConsentChecked: !!r.doping_consent_checked,
  active: r.active !== false,
  updatedAt: str(r.updated_at),
});
const personToRow = (p: RosterPerson): Row => ({
  university_id: p.universityId,
  gender: p.gender,
  academic_year: p.academicYear,
  kind: p.kind,
  name: p.name,
  kana: p.kana,
  birth_date: p.birthDate || null,
  grade: p.grade,
  faculty: p.faculty,
  position: p.position,
  high_school: p.highSchool,
  height_cm: p.heightCm,
  weight_kg: p.weightKg,
  handedness: p.handedness,
  foreign_status: p.foreignStatus,
  default_title: p.defaultTitle,
  is_student: p.isStudent,
  photo_path: p.photoKey,
  photo_consent: p.photoConsent,
  doping_consent_checked: p.dopingConsentChecked,
  active: p.active,
});

const entryFromRow = (r: Row): Entry => ({
  id: str(r.id),
  teamId: str(r.team_id),
  personId: str(r.person_id),
  isEntry: !!r.is_entry,
  number: num(r.number),
  bench: !!r.bench,
  title: str(r.title),
  insuranceOptIn: !!r.insurance_opt_in,
});

const membershipFromRow = (r: Row): Membership & { tournamentId: string } => ({
  id: str(r.id),
  tournamentId: str(r.tournament_id),
  email: str(r.email),
  role: r.role as Membership["role"],
  universityId: (r.university_id as string) ?? null,
  regionId: (r.region_id as string) ?? null,
  displayName: str(r.display_name),
  invitedAt: (r.invited_at as string) ?? null,
});

/** メールのリンクのエラーを日本語にする */
function explainLinkError(msg: string): string {
  if (/expired|invalid/i.test(msg))
    return "ログイン用のリンクの有効期限が切れているか、すでに使われています。もう一度「ログイン用のメールを送る」を押して、新しいメールのリンクを開いてください。";
  return `ログインできませんでした（${msg}）。もう一度お試しください。`;
}


function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class LiveStore extends BaseStore implements DataStore {
  readonly mode = "live" as const;
  readonly client: SupabaseClient;
  /** ログイン状態がわかったか */
  ready = false;

  constructor() {
    super();
    this.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    });
  }

  // ---- ログイン ----

  /** メールのリンクから戻ってきたときのエラー（画面に表示する） */
  authError: string | null = null;

  /** 起動時：ログイン済みなら読み込む。戻り値はログインしているか */
  async init(): Promise<boolean> {
    // メールのリンクから戻ってきたときの情報（#access_token=… または #error=…、?code=…）
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const linkError = hash.get("error_description") || query.get("error_description");
    const code = query.get("code");

    if (code) {
      const { error } = await this.client.auth.exchangeCodeForSession(code);
      if (error) this.authError = "ログイン用のリンクを確認できませんでした。メールを送ったときと同じブラウザで開くか、メールに書かれた確認コードを入力してください。";
    }
    const { data } = await this.client.auth.getSession();
    if (linkError) this.authError = explainLinkError(linkError);
    // URL に残ったログイン情報を消す
    if (hash.has("access_token") || hash.has("error") || linkError || code) {
      history.replaceState(null, "", window.location.pathname);
    }
    this.ready = true;
    if (!data.session) {
      if (!this.authError && hash.has("access_token")) this.authError = "ログイン情報を保存できませんでした。もう一度お試しください。";
      this.emit();
      return false;
    }
    await this.refresh();
    return true;
  }

  /** ログイン用のメール（リンクと確認コード）を送る */
  async requestLogin(email: string) {
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      if (/rate limit|seconds/i.test(error.message)) throw new Error("メールの送信回数が多すぎます。1分ほど待ってから、もう一度お試しください。");
      if (/sending .*email|smtp/i.test(error.message))
        throw new Error("ログイン用のメールを送れませんでした。システムのメール送信設定に問題があります。大会事務局にご連絡ください。");
      throw new Error(error.message);
    }
  }

  /** メールに書かれた確認コードでログインする */
  async verifyCode(email: string, code: string) {
    const { error } = await this.client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    if (error) throw new Error("コードが正しくないか、有効期限が切れています。もう一度メールを送ってください。");
    await this.refresh();
  }

  async signOut() {
    await this.client.auth.signOut();
    this.setSnapshot(emptySnapshot());
  }

  // ---- 読み込み ----

  private async all<X>(table: string, map: (r: Row) => X, eq?: [string, string | number]): Promise<X[]> {
    // Supabase は1回に1000行までしか返さないので、分けて読む
    const out: X[] = [];
    for (let from = 0; ; from += 1000) {
      let q = this.client.from(table).select("*");
      if (eq) q = q.eq(eq[0], eq[1]);
      const { data, error } = await q.range(from, from + 999);
      fail(error);
      out.push(...(data ?? []).map((r) => map(r as Row)));
      if (!data || data.length < 1000) return out;
    }
  }

  async selectTournament(id: string) {
    try {
      localStorage.setItem(CURRENT_KEY, id);
    } catch {}
    await this.refresh();
  }

  async refresh() {
    const { data: userData } = await this.client.auth.getUser();
    const email = (userData.user?.email ?? "").toLowerCase();
    const s = emptySnapshot();
    s.email = email;
    if (!email) {
      this.setSnapshot(s);
      return;
    }
    const memberships = await this.all("memberships", membershipFromRow);
    const mine = memberships.filter((m) => m.email === email);
    const tourRows = await this.all("tournaments", (r) => r);
    const tours = tourRows
      .filter((r) => mine.some((m) => m.tournamentId === r.id))
      .sort((a, b) => Number(b.academic_year) - Number(a.academic_year) || str(a.start_date).localeCompare(str(b.start_date)));
    s.tournaments = tours.map(tournamentFromRow);
    if (!tours.length) {
      this.setSnapshot(s);
      return;
    }
    let wanted = "";
    try {
      wanted = localStorage.getItem(CURRENT_KEY) ?? "";
    } catch {}
    const tour = tours.find((t) => t.id === wanted) ?? tours[0];
    const tid = str(tour.id);
    const year = Number(tour.academic_year);
    s.tournamentId = tid;
    s.settings = settingsFromRow(tour);
    s.myMemberships = mine.filter((m) => m.tournamentId === tid);
    s.allMemberships = memberships.filter((m) => m.tournamentId === tid);

    const [regions, divisions, universities, tus, teams, roster] = await Promise.all([
      this.all("regions", (r): Region => ({ id: str(r.id), code: str(r.code), name: str(r.name), sortOrder: Number(r.sort_order) }), ["tournament_id", tid]),
      this.all("divisions", (r): Division => ({ id: str(r.id), gender: r.gender as Gender, name: str(r.name), sortOrder: Number(r.sort_order), entryFee: num(r.entry_fee) }), ["tournament_id", tid]),
      this.all("universities", (r) => ({ id: str(r.id), name: str(r.name), kana: str(r.kana) })),
      this.all("tournament_universities", (r): TournamentUniversity => ({
        universityId: str(r.university_id), regionId: str(r.region_id),
        menDivisionId: (r.men_division_id as string) ?? null, womenDivisionId: (r.women_division_id as string) ?? null,
      }), ["tournament_id", tid]),
      this.all("teams", teamFromRow, ["tournament_id", tid]),
      this.all("roster_people", personFromRow, ["academic_year", year]),
    ]);
    const teamIds = new Set(teams.map((t) => t.id));
    const inTeams = <X extends { teamId: string }>(xs: X[]) => xs.filter((x) => teamIds.has(x.teamId));
    const [entries, uniforms, assets, comments] = await Promise.all([
      this.all("entries", entryFromRow),
      this.all("uniforms", (r): Uniform => ({ id: str(r.id), teamId: str(r.team_id), use: r.use as Uniform["use"], color: str(r.color), tone: r.tone as Uniform["tone"], sponsor: !!r.sponsor })),
      this.all("team_assets", (r): TeamAsset => ({ id: str(r.id), teamId: str(r.team_id), kind: r.kind as AssetKind, path: str(r.path), width: num(r.width), height: num(r.height) })),
      this.all("review_comments", (r): ReviewComment => ({ id: str(r.id), teamId: str(r.team_id), authorEmail: str(r.author_email), authorRole: str(r.author_role), action: r.action as ReviewComment["action"], body: str(r.body), createdAt: str(r.created_at) })),
    ]);
    Object.assign(s, {
      regions, divisions, universities, tournamentUniversities: tus, teams, roster,
      entries: inTeams(entries), uniforms: inTeams(uniforms), assets: inTeams(assets), comments: inTeams(comments),
    });
    this.setSnapshot(s);
  }

  // ---- 部員名簿 ----

  async savePerson(p: RosterPerson) {
    const row = personToRow(p);
    const { data, error } = p.id
      ? await this.client.from("roster_people").update(row).eq("id", p.id).select().single()
      : await this.client.from("roster_people").insert(row).select().single();
    fail(error);
    const saved = personFromRow(data as Row);
    const exists = this.snap.roster.some((x) => x.id === saved.id);
    this.setSnapshot({ ...this.snap, roster: exists ? this.snap.roster.map((x) => (x.id === saved.id ? saved : x)) : [...this.snap.roster, saved] });
    return saved;
  }
  async removePerson(id: string) {
    const p = this.person(id);
    if (!p) return;
    // エントリー済みの人は削除できない（データベースが拒否する）ので、名簿から外す
    const { data, error } = await this.client.from("roster_people").delete().eq("id", id).select();
    fail(error);
    if (data && data.length > 0) {
      if (p.photoKey) await this.client.storage.from(BUCKET).remove([p.photoKey]);
    } else {
      await this.savePerson({ ...p, active: false });
    }
    await this.refresh();
  }
  async putPersonPhoto(universityId: string, blob: Blob) {
    return this.upload(universityId, blob);
  }

  private async upload(folder: string, blob: Blob) {
    const png = blob.type === "image/png";
    const path = `${folder}/${crypto.randomUUID()}.${png ? "png" : "jpg"}`;
    const { error } = await this.client.storage.from(BUCKET).upload(path, blob, { contentType: png ? "image/png" : "image/jpeg", upsert: false });
    fail(error);
    return path;
  }
  protected async fetchPhoto(path: string) {
    const { data, error } = await this.client.storage.from(BUCKET).download(path);
    if (error) return undefined;
    return data ?? undefined;
  }

  // ---- チームの入力 ----

  async createTeam(universityId: string, gender: Gender) {
    const tu = this.snap.tournamentUniversities.find((x) => x.universityId === universityId);
    if (!tu) throw new Error("この大学はこの大会の参加大学として登録されていません。主催者にお問い合わせください。");
    const { data, error } = await this.client
      .from("teams")
      .insert({ tournament_id: this.snap.tournamentId, university_id: universityId, gender, region_id: tu.regionId, display_name: this.university(universityId)?.name ?? "" })
      .select()
      .single();
    fail(error);
    const team = teamFromRow(data as Row);
    this.setSnapshot({ ...this.snap, teams: [...this.snap.teams, team] });
    return team;
  }

  private replaceTeam(row: Row) {
    const t = teamFromRow(row);
    this.setSnapshot({ ...this.snap, teams: this.snap.teams.map((x) => (x.id === t.id ? t : x)) });
  }
  private async reloadTeam(teamId: string) {
    const { data, error } = await this.client.from("teams").select("*").eq("id", teamId).single();
    fail(error);
    this.replaceTeam(data as Row);
  }

  async saveTeam(team: Team) {
    const { data, error } = await this.client.from("teams").update(teamToRow(team)).eq("id", team.id).select().single();
    fail(error);
    this.replaceTeam(data as Row);
  }

  async saveEntries(teamId: string, list: Entry[]) {
    const keep = new Set(list.map((e) => e.personId));
    const removed = this.entries(teamId).filter((e) => !keep.has(e.personId));
    if (removed.length) fail((await this.client.from("entries").delete().in("id", removed.map((e) => e.id))).error);
    if (list.length) {
      const rows = list.map((e) => ({
        team_id: teamId, person_id: e.personId, is_entry: e.isEntry, number: e.number, bench: e.bench, title: e.title, insurance_opt_in: e.insuranceOptIn,
      }));
      fail((await this.client.from("entries").upsert(rows, { onConflict: "team_id,person_id" })).error);
    }
    await this.refresh();
  }

  async saveUniforms(teamId: string, uniforms: Uniform[]) {
    const keep = uniforms.filter((u) => u.id).map((u) => u.id);
    const old = this.uniforms(teamId).filter((u) => !keep.includes(u.id));
    if (old.length) fail((await this.client.from("uniforms").delete().in("id", old.map((u) => u.id))).error);
    for (const u of uniforms) {
      const row = { team_id: teamId, use: u.use, color: u.color, tone: u.tone, sponsor: u.sponsor };
      const { error } = u.id ? await this.client.from("uniforms").update(row).eq("id", u.id) : await this.client.from("uniforms").insert(row);
      fail(error);
    }
    await this.refresh();
  }

  async setAsset(teamId: string, kind: AssetKind, blob: Blob, width: number, height: number) {
    const old = this.assets(teamId).find((a) => a.kind === kind);
    const path = await this.upload(teamId, blob);
    fail((await this.client.from("team_assets").upsert({ team_id: teamId, kind, path, width, height }, { onConflict: "team_id,kind" })).error);
    if (old) {
      await this.client.storage.from(BUCKET).remove([old.path]);
      this.forgetPhoto(old.path);
    }
    await this.refresh();
  }
  async removeAsset(teamId: string, kind: AssetKind) {
    const old = this.assets(teamId).find((a) => a.kind === kind);
    if (!old) return;
    fail((await this.client.from("team_assets").delete().eq("id", old.id)).error);
    await this.client.storage.from(BUCKET).remove([old.path]);
    await this.refresh();
  }

  // ---- 提出・確認 ----

  async submit(teamId: string) {
    fail((await this.client.rpc("submit_team", { p_team: teamId })).error);
    await this.refresh();
  }
  async review(teamId: string, action: "approve" | "return" | "confirm", comment: string) {
    fail((await this.client.rpc("review_team", { p_team: teamId, p_action: action, p_comment: comment })).error);
    await this.refresh();
  }
  async unlock(teamId: string, untilIso: string | null, reason: string) {
    fail((await this.client.rpc("unlock_team", { p_team: teamId, p_until: untilIso, p_reason: reason })).error);
    await this.refresh();
  }
  async setPaperStatus(teamId: string, status: Team["paperStatus"]) {
    fail((await this.client.rpc("set_paper_status", { p_team: teamId, p_status: status })).error);
    await this.reloadTeam(teamId);
  }
  async setRegistrationConfirmed(teamId: string, confirmed: boolean) {
    const { data, error } = await this.client.from("teams").update({ registration_confirmed: confirmed }).eq("id", teamId).select().single();
    fail(error);
    this.replaceTeam(data as Row);
  }

  // ---- 事務局（主催者） ----

  async saveTournament(p: TournamentPatch) {
    if (!p.name.trim()) throw new Error("大会名を入力してください。");
    const { data: cur, error: e1 } = await this.client.from("tournaments").select("settings").eq("id", this.snap.tournamentId).single();
    fail(e1);
    const settings = { ...((cur as Row).settings as object), limits: p.limits, fees: p.fees };
    const { error } = await this.client
      .from("tournaments")
      .update({ name: p.name, short_name: p.shortName, start_date: p.startDate, entry_deadline: p.entryDeadlineAt, settings, features: p.features })
      .eq("id", this.snap.tournamentId);
    fail(error);
    await this.refresh();
  }
  async addUniversity(name: string, kana: string, regionId: string, menDivisionId: string | null, womenDivisionId: string | null) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("大学名を入力してください。");
    let id = this.snap.universities.find((u) => u.name === trimmed)?.id;
    if (!id) {
      const { data, error } = await this.client.from("universities").insert({ name: trimmed, kana: kana.trim() }).select().single();
      if (error && /duplicate/i.test(error.message)) throw new Error("同じ名前の大学がすでにあります。表示されていない場合は、別の大会で登録済みです。事務局にお問い合わせください。");
      fail(error);
      id = (data as Row).id as string;
    }
    const { error } = await this.client.from("tournament_universities").insert({
      tournament_id: this.snap.tournamentId, university_id: id, region_id: regionId, men_division_id: menDivisionId, women_division_id: womenDivisionId,
    });
    if (error && /duplicate/i.test(error.message)) throw new Error("この大学はすでに登録されています。");
    fail(error);
    await this.refresh();
  }
  async setUniversityDivision(universityId: string, gender: Gender, divisionId: string | null) {
    const col = gender === "men" ? "men_division_id" : "women_division_id";
    fail((await this.client.from("tournament_universities").update({ [col]: divisionId }).eq("tournament_id", this.snap.tournamentId).eq("university_id", universityId)).error);
    await this.refresh();
  }
  async addMembership(m: NewMembership) {
    const email = m.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("メールアドレスの形式が正しくありません。");
    const { error } = await this.client.from("memberships").insert({
      tournament_id: this.snap.tournamentId, email, role: m.role, university_id: m.universityId, region_id: m.regionId, display_name: m.displayName,
    });
    if (error && /duplicate/i.test(error.message)) throw new Error("この人はすでに同じ役割で登録されています。");
    fail(error);
    await this.refresh();
  }
  async removeMembership(id: string) {
    fail((await this.client.from("memberships").delete().eq("id", id)).error);
    await this.refresh();
  }
  /** 招待：ログイン用のメールを送り、送った日時を記録する */
  async sendLoginLink(email: string) {
    await this.requestLogin(email);
    const ids = this.snap.allMemberships.filter((m) => m.email === email).map((m) => m.id);
    if (ids.length) await this.client.from("memberships").update({ invited_at: new Date().toISOString() }).in("id", ids);
    await this.refresh();
  }
}
