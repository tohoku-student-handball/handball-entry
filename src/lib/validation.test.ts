import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS as S } from "./settings";
import { emptyMember, type Member, type Team } from "./types";
import { ageOn, feeSummary, validateMember, validateTeam } from "./validation";

let seq = 0;
function player(over: Partial<Member> = {}): Member {
  seq++;
  return {
    ...emptyMember("t1", "player"),
    id: `p${seq}`,
    name: "山田 太郎",
    kana: "やまだ たろう",
    birthDate: "2005-04-01",
    number: seq,
    grade: 3,
    faculty: "教育学部",
    position: "CB",
    highSchool: "仙台高校",
    heightCm: 180,
    weightKg: 75,
    handedness: "右",
    photoConsent: true,
    photoKey: "k",
    ...over,
  };
}
function staff(over: Partial<Member> = {}): Member {
  seq++;
  return {
    ...emptyMember("t1", "staff"),
    id: `s${seq}`,
    name: "佐藤 花子",
    kana: "さとう はなこ",
    birthDate: "1980-01-01",
    title: "監督",
    photoConsent: true,
    photoKey: "k",
    ...over,
  };
}
function team(over: Partial<Team> = {}): Team {
  return {
    id: "t1",
    universityId: "u1",
    gender: "men",
    regionId: "tohoku",
    status: "in_progress",
    displayName: "サンプル大学",
    contactName: "主務",
    contactPhone: "000",
    contactEmail: "a@example.com",
    jhaNumber: "1",
    studentFedNumber: "2",
    escort: { name: "佐藤 花子", title: "教授", qualified: true, staffMemberId: null },
    comment: "",
    updatedAt: "",
    ...over,
  };
}
const errors = (xs: { level: string; message: string }[]) => xs.filter((x) => x.level === "error").map((x) => x.message);

describe("ageOn", () => {
  it("誕生日の前日はまだ年を取らない", () => {
    expect(ageOn("2009-11-07", "2027-11-06")).toBe(17);
    expect(ageOn("2009-11-06", "2027-11-06")).toBe(18);
  });
});

describe("validateMember", () => {
  it("正しく入力された選手はエラーなし", () => {
    expect(errors(validateMember(player(), S))).toEqual([]);
  });
  it("背番号の範囲外", () => {
    expect(errors(validateMember(player({ number: 0 }), S)).join()).toContain("背番号は1〜99");
    expect(errors(validateMember(player({ number: 100 }), S)).join()).toContain("背番号は1〜99");
  });
  it("短期留学生はエントリー不可", () => {
    expect(errors(validateMember(player({ foreignStatus: "short_term" }), S)).join()).toContain("短期留学生");
  });
  it("氏名のみ掲載の部員は氏名とふりがなだけでよい", () => {
    const m = { ...emptyMember("t1", "player"), id: "x", name: "鈴木 一郎", kana: "すずき いちろう", isEntry: false };
    expect(errors(validateMember(m, S))).toEqual([]);
  });
  it("ふりがなはひらがなのみ", () => {
    expect(errors(validateMember(player({ kana: "ヤマダ" }), S)).join()).toContain("ひらがな");
  });
  it("未成年はドーピング同意書の確認が必要", () => {
    const minor = player({ birthDate: "2010-01-01" });
    expect(errors(validateMember(minor, S)).join()).toContain("ドーピング");
    expect(errors(validateMember({ ...minor, dopingConsentChecked: true }, S))).toEqual([]);
  });
  it("掲載同意ありで写真なしはエラー、同意なしは注意のみ", () => {
    expect(errors(validateMember(player({ photoKey: null }), S)).join()).toContain("顔写真");
    expect(errors(validateMember(player({ photoKey: null, photoConsent: false }), S))).toEqual([]);
  });
});

describe("validateTeam", () => {
  const base = () => [staff(), ...Array.from({ length: 10 }, () => player())];

  it("問題のないチーム", () => {
    const ms = base();
    expect(errors(validateTeam(team({ escort: { name: "佐藤", title: "教授", qualified: true, staffMemberId: ms[0].id } }), ms, S))).toEqual([]);
  });
  it("背番号の重複を検出する", () => {
    const ms = [staff(), player({ number: 7 }), player({ number: 7 })];
    expect(errors(validateTeam(team(), ms, S)).filter((m) => m.includes("背番号7が重複")).length).toBe(2);
  });
  it("エントリー26名はエラー", () => {
    const ms = [staff(), ...Array.from({ length: 26 }, (_, i) => player({ number: i + 1 }))];
    expect(errors(validateTeam(team(), ms, S)).join()).toContain("25名以内");
  });
  it("留学生4名はエラー、ベンチの留学生3名もエラー", () => {
    const ms = [staff(), ...Array.from({ length: 4 }, () => player({ foreignStatus: "foreign", bench: true }))];
    const e = errors(validateTeam(team(), ms, S)).join();
    expect(e).toContain("留学生のエントリーは3名まで");
    expect(e).toContain("ゲームエントリー（ベンチ登録）は2名まで");
  });
  it("ベンチの上限（選手16・役員5）", () => {
    const ms = [
      ...Array.from({ length: 6 }, () => staff({ bench: true })),
      ...Array.from({ length: 17 }, () => player({ bench: true })),
    ];
    const e = errors(validateTeam(team(), ms, S)).join();
    expect(e).toContain("選手は16名まで");
    expect(e).toContain("役員は5名まで");
  });
  it("役員7名はエラー", () => {
    const ms = [...Array.from({ length: 7 }, () => staff()), player()];
    expect(errors(validateTeam(team(), ms, S)).join()).toContain("6名以内");
  });
  it("引率責任者が役員名簿にいなければ注意を表示", () => {
    const issues = validateTeam(team(), base(), S);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("ベンチに入れません"))).toBe(true);
  });
});

describe("feeSummary", () => {
  it("選手全員＋学生役員＋任意加入の役員を数える（氏名のみの部員は含めない）", () => {
    const ms = [
      player(),
      player(),
      { ...player(), isEntry: false },
      staff({ isStudent: true }),
      staff({ insuranceOptIn: true }),
      staff(),
    ];
    const f = feeSummary(ms, S);
    expect(f.insured).toBe(4);
    expect(f.total).toBe(75000 + 4 * 500);
  });
});
