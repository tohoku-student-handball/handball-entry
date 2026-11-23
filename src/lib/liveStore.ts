"use client";
// 本番のデータ保存先（Supabase）。
// 誰が何を見られるかはデータベース側（supabase/migrations の RLS）で制限されているので、
// ここでは「見えるものを全部読み込む」だけでよい作りになっています。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS } from "./settings";
import { BaseStore, emptySnapshot, type DataStore, type NewMembership, type Snapshot } from "./store";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabaseConfig";
import type {
  AssetKind,
  Gender,
  Member,
  Membership,
  Region,
  ReviewComment,
  Team,
  TeamAsset,
  TournamentSettings,
  Uniform,
} from "./types";

const BUCKET = "team-files";

type Row = Record<string, unknown>;

// ---- データベースの列（snake_case）と画面の項目（camelCase）の変換 ----

const teamFromRow = (r: Row): Team => ({
  id: r.id as string,
  tournamentId: r.tournament_id as string,
  universityId: r.university_id as string,
  gender: r.gender as Gender,
  regionId: r.region_id as string,
  status: r.status as Team["status"],
  displayName: (r.display_name as string) ?? "",
  contactName: (r.contact_name as string) ?? "",
  contactPhone: (r.contact_phone as string) ?? "",
  contactEmail: (r.contact_email as string) ?? "",
  jhaNumber: (r.jha_number as string) ?? "",
  studentFedNumber: (r.student_fed_number as string) ?? "",
  escort: { name: "", title: "", qualified: false, staffMemberId: null, ...((r.escort as object) ?? {}) },
  comment: (r.comment as string) ?? "",
  registrationConfirmed: !!r.registration_confirmed,
  paperStatus: r.paper_status as Team["paperStatus"],
  unlockedUntil: (r.unlocked_until as string) ?? null,
  submittedAt: (r.submitted_at as string) ?? null,
  updatedAt: r.updated_at as string,
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

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const memberFromRow = (r: Row): Member => ({
  id: r.id as string,
  teamId: r.team_id as string,
  kind: r.kind as Member["kind"],
  name: (r.name as string) ?? "",
  kana: (r.kana as string) ?? "",
  birthDate: (r.birth_date as string) ?? "",
  isEntry: !!r.is_entry,
  number: num(r.number),
  grade: num(r.grade),
  faculty: (r.faculty as string) ?? "",
  position: (r.position as string) ?? "",
  highSchool: (r.high_school as string) ?? "",
  heightCm: num(r.height_cm),
  weightKg: num(r.weight_kg),
  handedness: (r.handedness as string) ?? "",
  foreignStatus: r.foreign_status as Member["foreignStatus"],
  bench: !!r.bench,
  title: (r.title as string) ?? "",
  isStudent: !!r.is_student,
  insuranceOptIn: !!r.insurance_opt_in,
  photoKey: (r.photo_path as string) ?? null,
  photoConsent: !!r.photo_consent,
  dopingConsentChecked: !!r.doping_consent_checked,
  updatedAt: r.updated_at as string,
});
const memberToRow = (m: Member): Row => ({
  team_id: m.teamId,
  kind: m.kind,
  name: m.name,
  kana: m.kana,
  birth_date: m.birthDate || null,
  is_entry: m.isEntry,
  number: m.number,
  grade: m.grade,
  faculty: m.faculty,
  position: m.position,
  high_school: m.highSchool,
  height_cm: m.heightCm,
  weight_kg: m.weightKg,
  handedness: m.handedness,
  foreign_status: m.foreignStatus,
  bench: m.bench,
  title: m.title,
  is_student: m.isStudent,
  insurance_opt_in: m.insuranceOptIn,
  photo_path: m.photoKey,
  photo_consent: m.photoConsent,
  doping_consent_checked: m.dopingConsentChecked,
});
const membershipFromRow = (r: Row): Membership => ({
  id: r.id as string,
  email: r.email as string,
  role: r.role as Membership["role"],
  universityId: (r.university_id as string) ?? null,
  regionId: (r.region_id as string) ?? null,
  displayName: (r.display_name as string) ?? "",
  invitedAt: (r.invited_at as string) ?? null,
});

/** 日本時間の日付（YYYY-MM-DD） */
function jstDate(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

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

  /** 起動時：ログイン済みなら読み込む。戻り値はログインしているか */
  /** メールのリンクから戻ってきたときのエラー（画面に表示する） */
  authError: string | null = null;

  async init(): Promise<boolean> {
    // メールのリンクから戻ってきたときの情報（#access_token=… または #error=…、?code=…）
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const linkError = hash.get("error_description") || query.get("error_description");
    const code = query.get("code");

    if (code) {
      const { error } = await this.client.auth.exchangeCodeForSession(code);
      if (error) this.authError = "ログイン用のリンクを確認できませんでした。メールを送ったときと同じブラウザで開くか、メールに書かれた6桁のコードを入力してください。";
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

  /** ログイン用のメール（リンクと6桁のコード）を送る */
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

  /** メールに書かれた6桁のコードでログインする */
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

  private async all<T>(table: string, map: (r: Row) => T, tournamentId?: string): Promise<T[]> {
    // Supabase は1回に1000行までしか返さないので、分けて読む
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      let q = this.client.from(table).select("*");
      if (tournamentId) q = q.eq("tournament_id", tournamentId);
      const { data, error } = await q.range(from, from + 999);
      fail(error);
      out.push(...(data ?? []).map((r) => map(r as Row)));
      if (!data || data.length < 1000) return out;
    }
  }

  async refresh() {
    const { data: userData } = await this.client.auth.getUser();
    const email = (userData.user?.email ?? "").toLowerCase();
    if (!email) {
      this.setSnapshot(emptySnapshot());
      return;
    }
    const memberships = await this.all("memberships", (r) => ({ ...membershipFromRow(r), tournamentId: r.tournament_id as string }));
    const mine = memberships.filter((m) => m.email === email);
    const s = emptySnapshot();
    s.email = email;
    if (mine.length === 0) {
      this.setSnapshot(s);
      return;
    }
    // 所属している大会のうち、いちばん新しい年度を開く
    const { data: tours, error: te } = await this.client.from("tournaments").select("*").order("year", { ascending: false });
    fail(te);
    const tour = (tours ?? []).find((t) => mine.some((m) => m.tournamentId === t.id));
    if (!tour) {
      this.setSnapshot(s);
      return;
    }
    const tid = tour.id as string;
    s.tournamentId = tid;
    s.settings = {
      ...DEFAULT_SETTINGS,
      ...((tour.settings as Partial<TournamentSettings>) ?? {}),
      name: tour.name as string,
      startDate: tour.start_date as string,
      entryDeadlineAt: tour.entry_deadline as string,
      entryDeadline: jstDate(tour.entry_deadline as string),
    };
    s.myMemberships = mine.filter((m) => m.tournamentId === tid);
    s.allMemberships = memberships.filter((m) => m.tournamentId === tid);

    const [regions, universities, tus, teams] = await Promise.all([
      this.all("regions", (r): Region => ({ id: r.id as string, code: r.code as string, name: r.name as string, sortOrder: r.sort_order as number }), tid),
      this.all("universities", (r) => ({ id: r.id as string, name: r.name as string, kana: (r.kana as string) ?? "" })),
      this.all("tournament_universities", (r) => ({ universityId: r.university_id as string, regionId: r.region_id as string }), tid),
      this.all("teams", teamFromRow, tid),
    ]);
    const teamIds = new Set(teams.map((t) => t.id));
    const inTeams = <T extends { teamId: string }>(xs: T[]) => xs.filter((x) => teamIds.has(x.teamId));
    const [members, uniforms, assets, comments] = await Promise.all([
      this.all("members", memberFromRow),
      this.all("uniforms", (r): Uniform => ({ id: r.id as string, teamId: r.team_id as string, use: r.use as Uniform["use"], color: (r.color as string) ?? "", tone: r.tone as Uniform["tone"], sponsor: !!r.sponsor })),
      this.all("team_assets", (r): TeamAsset => ({ id: r.id as string, teamId: r.team_id as string, kind: r.kind as AssetKind, path: r.path as string, width: num(r.width), height: num(r.height) })),
      this.all("review_comments", (r): ReviewComment => ({ id: r.id as string, teamId: r.team_id as string, authorEmail: r.author_email as string, authorRole: r.author_role as string, action: r.action as ReviewComment["action"], body: (r.body as string) ?? "", createdAt: r.created_at as string })),
    ]);
    Object.assign(s, { regions, universities, tournamentUniversities: tus, teams, members: inTeams(members), uniforms: inTeams(uniforms), assets: inTeams(assets), comments: inTeams(comments) });
    this.setSnapshot(s);
  }

  // ---- チームの入力 ----

  async createTeam(universityId: string, gender: Gender) {
    const tu = this.snap.tournamentUniversities.find((x) => x.universityId === universityId);
    if (!tu) throw new Error("この大学は今年度の参加大学として登録されていません。事務局にお問い合わせください。");
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

  async saveMember(member: Member) {
    const row = memberToRow(member);
    const q = member.id
      ? this.client.from("members").update(row).eq("id", member.id).select().single()
      : this.client.from("members").insert(row).select().single();
    const { data, error } = await q;
    fail(error);
    const m = memberFromRow(data as Row);
    const exists = this.snap.members.some((x) => x.id === m.id);
    this.setSnapshot({ ...this.snap, members: exists ? this.snap.members.map((x) => (x.id === m.id ? m : x)) : [...this.snap.members, m] });
    await this.reloadTeam(m.teamId);
    return m;
  }

  async deleteMember(id: string) {
    const m = this.member(id);
    const { error } = await this.client.from("members").delete().eq("id", id);
    fail(error);
    if (m?.photoKey) await this.client.storage.from(BUCKET).remove([m.photoKey]);
    this.setSnapshot({ ...this.snap, members: this.snap.members.filter((x) => x.id !== id) });
    const t = m && this.team(m.teamId);
    if (t && t.escort.staffMemberId === id) await this.saveTeam({ ...t, escort: { ...t.escort, staffMemberId: null } });
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

  async putPhoto(teamId: string, blob: Blob) {
    const png = blob.type === "image/png";
    const path = `${teamId}/${crypto.randomUUID()}.${png ? "png" : "jpg"}`;
    const { error } = await this.client.storage.from(BUCKET).upload(path, blob, { contentType: png ? "image/png" : "image/jpeg", upsert: false });
    fail(error);
    return path;
  }
  protected async fetchPhoto(path: string) {
    const { data, error } = await this.client.storage.from(BUCKET).download(path);
    if (error) return undefined;
    return data ?? undefined;
  }

  async setAsset(teamId: string, kind: AssetKind, blob: Blob, width: number, height: number) {
    const old = this.assets(teamId).find((a) => a.kind === kind);
    const path = await this.putPhoto(teamId, blob);
    const { error } = await this.client
      .from("team_assets")
      .upsert({ team_id: teamId, kind, path, width, height }, { onConflict: "team_id,kind" });
    fail(error);
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

  // ---- 事務局 ----

  async addUniversity(name: string, kana: string, regionId: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("大学名を入力してください。");
    let id = this.snap.universities.find((u) => u.name === trimmed)?.id;
    if (!id) {
      const { data, error } = await this.client.from("universities").insert({ name: trimmed, kana: kana.trim() }).select().single();
      fail(error);
      id = (data as Row).id as string;
    }
    const { error } = await this.client.from("tournament_universities").insert({ tournament_id: this.snap.tournamentId, university_id: id, region_id: regionId });
    if (error && /duplicate/i.test(error.message)) throw new Error("この大学はすでに登録されています。");
    fail(error);
    await this.refresh();
  }
  async addMembership(m: NewMembership) {
    const email = m.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("メールアドレスの形式が正しくありません。");
    const { error } = await this.client.from("memberships").insert({
      tournament_id: this.snap.tournamentId,
      email,
      role: m.role,
      university_id: m.universityId,
      region_id: m.regionId,
      display_name: m.displayName,
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
