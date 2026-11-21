// 申込内容のルール判定。画面にもデータベースにも依存しない純粋な関数だけを置きます。
// level: "error" は提出できない不備、"warning" は注意（提出は可能）。

import type { Member, Team, TeamAsset, TournamentSettings, Uniform } from "./types";
import { ASSET_LABEL } from "./types";

export type IssueLevel = "error" | "warning";
export interface Issue {
  level: IssueLevel;
  message: string;
  /** 対象の選手・役員の id（チーム全体の問題なら undefined） */
  memberId?: string;
  /** 対象の項目名（画面で赤く表示する用） */
  field?: string;
}

const HIRAGANA = /^[ぁ-ゖー　 ]+$/;

/** 指定日時点の満年齢 */
export function ageOn(birthDate: string, onDate: string): number | null {
  const b = parseDate(birthDate);
  const d = parseDate(onDate);
  if (!b || !d) return null;
  let age = d.y - b.y;
  if (d.m < b.m || (d.m === b.m && d.d < b.d)) age--;
  return age;
}

function parseDate(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function isMinor(member: Member, settings: TournamentSettings): boolean {
  const age = ageOn(member.birthDate, settings.startDate);
  return age !== null && age < settings.adultAge;
}

/** 保険に加入する人か（選手・学生役員は必須、それ以外は任意） */
export function isInsured(member: Member): boolean {
  if (member.kind === "player") return true;
  return member.isStudent || member.insuranceOptIn;
}

/** 選手・役員1人分のチェック */
export function validateMember(m: Member, s: TournamentSettings): Issue[] {
  const issues: Issue[] = [];
  const err = (field: string, message: string) => issues.push({ level: "error", field, message, memberId: m.id });
  const warn = (field: string, message: string) => issues.push({ level: "warning", field, message, memberId: m.id });

  if (!m.name.trim()) err("name", "氏名を入力してください。");
  if (!m.kana.trim()) err("kana", "ふりがなを入力してください。");
  else if (!HIRAGANA.test(m.kana)) err("kana", "ふりがなは、ひらがなで入力してください。");

  const isFullEntry = m.kind === "staff" || m.isEntry;
  if (!isFullEntry) {
    // 氏名のみ掲載の部員
    if (m.foreignStatus === "short_term") warn("foreignStatus", "短期留学生はエントリーできません（氏名のみの掲載になります）。");
    return issues;
  }

  if (!m.birthDate) err("birthDate", "生年月日を入力してください（保険と未成年の確認に使います）。");
  else if (ageOn(m.birthDate, s.startDate) === null) err("birthDate", "生年月日の形式が正しくありません。");

  if (m.name.replace(/[\s　]/g, "").length > s.textLimits.name)
    warn("name", `氏名が${s.textLimits.name}文字を超えています。パンフレットで文字が小さくなる場合があります。`);

  if (m.kind === "player") {
    const { numberMin, numberMax } = s.limits;
    if (m.number === null) err("number", "背番号を入力してください。");
    else if (!Number.isInteger(m.number) || m.number < numberMin || m.number > numberMax)
      err("number", `背番号は${numberMin}〜${numberMax}の整数で入力してください。`);

    if (m.foreignStatus === "short_term") err("foreignStatus", "短期留学生はエントリーできません。「氏名のみ掲載」に変更してください。");

    if (!m.grade) err("grade", "学年を選んでください。");
    if (!m.faculty.trim()) err("faculty", "学部を入力してください。");
    else if (m.faculty.length > s.textLimits.faculty) warn("faculty", `学部が${s.textLimits.faculty}文字を超えています。略称をご検討ください。`);
    if (!m.position) err("position", "ポジションを選んでください。");
    if (!m.highSchool.trim()) err("highSchool", "出身高校を入力してください。");
    else if (m.highSchool.length > s.textLimits.highSchool) warn("highSchool", `出身高校が${s.textLimits.highSchool}文字を超えています。略称をご検討ください。`);
    if (m.heightCm === null) err("heightCm", "身長を入力してください。");
    else if (m.heightCm < 120 || m.heightCm > 230) err("heightCm", "身長は120〜230cmの範囲で入力してください。");
    if (m.weightKg === null) err("weightKg", "体重を入力してください。");
    else if (m.weightKg < 35 || m.weightKg > 160) err("weightKg", "体重は35〜160kgの範囲で入力してください。");
    if (!m.handedness) err("handedness", "利き手を選んでください。");

    if (isMinor(m, s) && !m.dopingConsentChecked)
      err("dopingConsentChecked", "未成年の選手です。保護者のドーピング検査同意書を携帯していることを確認し、チェックを入れてください。");
  } else {
    if (!m.title) err("title", "役職を選んでください。");
  }

  if (m.photoConsent && !m.photoKey) err("photo", "顔写真をアップロードしてください（掲載に同意している場合は必須です）。");
  if (!m.photoConsent) warn("photoConsent", "写真の掲載に同意していないため、パンフレットには写真なしで掲載されます。");

  return issues;
}

/** チーム全体のチェック（人数・背番号の重複・留学生・ベンチ・引率責任者） */
export function validateTeam(team: Team, members: Member[], s: TournamentSettings): Issue[] {
  const issues: Issue[] = [];
  const L = s.limits;
  const players = members.filter((m) => m.kind === "player");
  const entries = players.filter((m) => m.isEntry);
  const staff = members.filter((m) => m.kind === "staff");

  if (entries.length > L.playerEntryMax)
    issues.push({ level: "error", message: `エントリー選手が${entries.length}名です。${L.playerEntryMax}名以内にしてください（超えた分は「氏名のみ掲載」に変更）。` });
  if (entries.length === 0) issues.push({ level: "error", message: "エントリー選手が登録されていません。" });
  if (staff.length > L.staffMax)
    issues.push({ level: "error", message: `役員が${staff.length}名です。${L.staffMax}名以内にしてください。` });
  if (staff.length === 0) issues.push({ level: "error", message: "役員が登録されていません。" });

  // 背番号の重複
  const byNumber = new Map<number, Member[]>();
  for (const p of entries) {
    if (p.number === null) continue;
    byNumber.set(p.number, [...(byNumber.get(p.number) ?? []), p]);
  }
  for (const [num, ps] of byNumber) {
    if (ps.length > 1) {
      const names = ps.map((p) => p.name || "（氏名未入力）").join("・");
      for (const p of ps)
        issues.push({ level: "error", memberId: p.id, field: "number", message: `背番号${num}が重複しています（${names}）。` });
    }
  }

  // 留学生
  const foreignEntries = entries.filter((p) => p.foreignStatus === "foreign");
  if (foreignEntries.length > L.foreignEntryMax)
    issues.push({ level: "error", message: `留学生のエントリーは${L.foreignEntryMax}名までです（現在${foreignEntries.length}名）。` });
  const foreignBench = foreignEntries.filter((p) => p.bench);
  if (foreignBench.length > L.foreignGameEntryMax)
    issues.push({ level: "error", message: `留学生のゲームエントリー（ベンチ登録）は${L.foreignGameEntryMax}名までです（現在${foreignBench.length}名）。` });

  // ベンチ登録
  const benchPlayers = entries.filter((p) => p.bench);
  const benchStaff = staff.filter((p) => p.bench);
  if (benchPlayers.length > L.benchPlayerMax)
    issues.push({ level: "error", message: `ベンチ登録の選手は${L.benchPlayerMax}名までです（現在${benchPlayers.length}名）。` });
  if (benchStaff.length > L.benchStaffMax)
    issues.push({ level: "error", message: `ベンチ登録の役員は${L.benchStaffMax}名までです（現在${benchStaff.length}名）。` });

  // 引率責任者
  const e = team.escort;
  if (!e.name.trim()) issues.push({ level: "error", field: "escort", message: "引率責任者を入力してください。" });
  else {
    if (!e.qualified)
      issues.push({ level: "error", field: "escort", message: "引率責任者が「大学の専任教職員、または部長が任命した者」であることを確認し、チェックを入れてください。" });
    const linked = e.staffMemberId ? staff.find((m) => m.id === e.staffMemberId) : undefined;
    if (!linked)
      issues.push({ level: "warning", field: "escort", message: "引率責任者が役員名簿に登録されていません。このままではベンチに入れません。" });
  }

  // 基本情報
  if (!team.contactName.trim() || !team.contactEmail.trim() || !team.contactPhone.trim())
    issues.push({ level: "error", field: "contact", message: "連絡担当者の氏名・電話・メールを入力してください。" });
  if (!team.jhaNumber.trim()) issues.push({ level: "error", field: "jha", message: "JHA（日本ハンドボール協会）のチーム登録番号を入力してください。" });
  if (!team.studentFedNumber.trim()) issues.push({ level: "error", field: "fed", message: "全日本学連の登録番号を入力してください。" });

  for (const m of members) issues.push(...validateMember(m, s));
  return issues;
}

/** 保険加入者数と請求額 */
export function feeSummary(members: Member[], s: TournamentSettings) {
  const insured = members.filter((m) => (m.kind === "staff" || m.isEntry) && isInsured(m)).length;
  return {
    insured,
    insuranceFee: insured * s.fees.insurancePerPerson,
    entryFee: s.fees.entry,
    total: s.fees.entry + insured * s.fees.insurancePerPerson,
  };
}

/** ユニフォームのチェック：CP用・GK用それぞれ濃色と淡色が1着以上 */
export function validateUniforms(uniforms: Uniform[]): Issue[] {
  const issues: Issue[] = [];
  for (const use of ["CP", "GK"] as const) {
    const list = uniforms.filter((u) => u.use === use);
    const label = use === "CP" ? "CP（コートプレーヤー）用" : "GK（ゴールキーパー）用";
    if (!list.some((u) => u.tone === "dark")) issues.push({ level: "error", field: "uniform", message: `${label}の濃い色のユニフォームを登録してください。` });
    if (!list.some((u) => u.tone === "light")) issues.push({ level: "error", field: "uniform", message: `${label}の淡い色のユニフォームを登録してください。` });
    if (list.some((u) => !u.color.trim())) issues.push({ level: "error", field: "uniform", message: `${label}のユニフォームに、色の名前が入っていないものがあります。` });
  }
  return issues;
}

/** 集合写真・ロゴのチェック */
export function validateAssets(assets: TeamAsset[]): Issue[] {
  return (["group", "logo"] as const)
    .filter((k) => !assets.some((a) => a.kind === k))
    .map((k) => ({ level: "error" as const, field: "asset", message: `${ASSET_LABEL[k]}をアップロードしてください。` }));
}

/** 提出前の全項目チェック */
export function validateSubmission(
  team: Team,
  members: Member[],
  uniforms: Uniform[],
  assets: TeamAsset[],
  s: TournamentSettings,
): Issue[] {
  return [...validateTeam(team, members, s), ...validateUniforms(uniforms), ...validateAssets(assets)];
}

/** 協賛企業名入りユニフォームの着種数と現地払いの金額 */
export function sponsorFee(uniforms: Uniform[], s: TournamentSettings) {
  const count = uniforms.filter((u) => u.sponsor).length;
  return { count, amount: count * s.fees.sponsorUniform };
}

/** チームが今、名簿などを変更できるか（データベースの team_is_editable と同じ判定） */
export function isEditable(team: Team, s: TournamentSettings, now: Date = new Date()): boolean {
  if (!["not_started", "in_progress", "returned"].includes(team.status)) return false;
  if (now.getTime() <= new Date(s.entryDeadlineAt).getTime()) return true;
  return !!team.unlockedUntil && now.getTime() <= new Date(team.unlockedUntil).getTime();
}

/** 変更できない理由（画面に表示する） */
export function lockReason(team: Team, s: TournamentSettings, now: Date = new Date()): string | null {
  if (isEditable(team, s, now)) return null;
  if (team.status === "submitted") return "提出済みのため、地区学連の確認が終わるまで変更できません。直す必要がある場合は地区学連にご連絡ください。";
  if (team.status === "region_approved" || team.status === "office_confirmed")
    return "承認済みのため変更できません。変更が必要な場合は大会事務局にご連絡ください。";
  return "申込締切を過ぎたため変更できません。変更が必要な場合は大会事務局にご連絡ください。";
}
