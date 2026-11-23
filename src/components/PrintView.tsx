"use client";
import { useStore } from "@/lib/store";
import { FOREIGN_LABEL, GENDER_LABEL, TEAM_STATUS_LABEL, type Team } from "@/lib/types";
import { feeSummary, isInsured } from "@/lib/validation";
import { yen } from "./ui";

/** 申込書（様式Ⅰ 参加申込書・様式Ⅲ 引率責任者届出）。A4で印刷し、大学の角印を押す */
export function PrintView({ team }: { team: Team }) {
  const store = useStore();
  const s = store.settings();
  const uni = store.university(team.universityId);
  const members = store.members(team.id);
  const staff = members.filter((m) => m.kind === "staff");
  const entries = members.filter((m) => m.kind === "player" && m.isEntry).sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
  const nameOnly = members.filter((m) => m.kind === "player" && !m.isEntry);
  const uniforms = store.uniforms(team.id);
  const f = store.features();
  const division = store.division(team.divisionId);
  const fees = feeSummary(members, s, { insurance: f.insurance, entryFee: division?.entryFee });
  const draft = !["submitted", "region_approved", "office_confirmed"].includes(team.status);
  const blankDate = "令和　　年　　月　　日";

  return (
    <div className="stack">
      <section className="card no-print">
        <p>
          A4用紙で印刷してください。
          {f.paper && <>印刷したら、<strong>大学の角印</strong>と、部長の署名・押印をして郵送してください。</>}
        </p>
        {draft && <p className="notice">まだ提出していないため、申込書に「下書き」と表示されます。提出してから印刷してください。</p>}
        <div className="row">
          <button className="btn primary" onClick={() => window.print()}>
            印刷する
          </button>
        </div>
        <p className="hint">「印刷する」で何も起きない場合は、ブラウザのメニューから「印刷」を選んでください。PDFで保存する場合は、印刷先に「PDFに保存」を選びます。</p>
      </section>

      <article className="sheet">
        {draft && <p className="draft-mark">下書き（未提出）</p>}
        <p className="sheet-form">{f.paper ? "様式Ⅰ" : "申込内容の控え"}</p>
        <h2 className="sheet-title">
          {s.name}
          <br />
          参加申込書
        </h2>
        <table className="form-table">
          <tbody>
            <tr><th>大学名</th><td colSpan={3}>{uni?.name}</td></tr>
            <tr><th>チーム（男女）</th><td>{team.displayName}（{GENDER_LABEL[team.gender]}）</td><th>{division ? "部" : "所属地区"}</th><td>{division ? division.name : store.region(team.regionId)?.name}</td></tr>
            <tr><th>JHA登録番号</th><td>{team.jhaNumber}</td><th>全日本学連登録番号</th><td>{team.studentFedNumber}</td></tr>
            <tr><th>連絡担当者</th><td>{team.contactName}</td><th>電話</th><td>{team.contactPhone}</td></tr>
            <tr><th>メール</th><td colSpan={3}>{team.contactEmail}</td></tr>
          </tbody>
        </table>

        <h3 className="sheet-h">役員（{staff.length}名）</h3>
        <table className="form-table dense">
          <thead><tr><th>役職</th><th>氏名</th><th>ふりがな</th><th>ベンチ</th>{f.insurance && <th>傷害保険</th>}</tr></thead>
          <tbody>
            {staff.map((m) => (
              <tr key={m.id}><td>{m.title}</td><td>{m.name}</td><td>{m.kana}</td><td className="c">{m.bench ? "○" : ""}</td>{f.insurance && <td className="c">{isInsured(m) ? "加入" : ""}</td>}</tr>
            ))}
          </tbody>
        </table>

        <h3 className="sheet-h">選手（エントリー {entries.length}名）</h3>
        <table className="form-table dense">
          <thead>
            <tr><th>No.</th><th>氏名</th><th>ふりがな</th><th>学年</th><th>Pos</th><th>身長</th><th>体重</th><th>出身高校</th><th>区分</th><th>ベンチ</th></tr>
          </thead>
          <tbody>
            {entries.map((m) => (
              <tr key={m.id}>
                <td className="c">{m.number}</td><td>{m.name}</td><td>{m.kana}</td><td className="c">{m.grade}</td><td className="c">{m.position}</td>
                <td className="c">{m.heightCm}</td><td className="c">{m.weightKg}</td><td>{m.highSchool}</td>
                <td className="c">{m.foreignStatus !== "none" ? FOREIGN_LABEL[m.foreignStatus] : ""}</td><td className="c">{m.bench ? "○" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {nameOnly.length > 0 && <p className="sheet-note">氏名のみ掲載：{nameOnly.map((m) => m.name).join("、")}</p>}

        <h3 className="sheet-h">ユニフォーム</h3>
        <p className="sheet-note">
          {(["CP", "GK"] as const).map((use) => (
            <span key={use} className="sheet-inline">
              {use}用：
              {uniforms
                .filter((u) => u.use === use)
                .map((u) => `${u.color}（${u.tone === "dark" ? "濃" : "淡"}${u.sponsor ? "・協賛企業名入り" : ""}）`)
                .join("、") || "—"}
            </span>
          ))}
        </p>
        <p className="sheet-note">
          参加料 {yen(fees.entryFee)}
          {f.insurance && <>／傷害保険料 {yen(s.fees.insurancePerPerson)}×{fees.insured}名＝{yen(fees.insuranceFee)}</>}／<strong>合計 {yen(fees.total)}</strong>
        </p>

        <p className="sheet-declare">上記のとおり、本大会への参加を申し込みます。</p>
        <div className="sign-area">
          <div className="sign-lines">
            <p>{blankDate}</p>
            <p>大学名　{uni?.name}</p>
            <p>部長　氏名　＿＿＿＿＿＿＿＿＿＿＿＿　印</p>
          </div>
          <div className="seal-box">大学<br />角印</div>
        </div>
        <p className="sheet-foot">状態：{TEAM_STATUS_LABEL[team.status]}／出力：{new Date().toLocaleString("ja-JP")}</p>
      </article>

      {f.escort && (
      <article className="sheet page-break">
        {draft && <p className="draft-mark">下書き（未提出）</p>}
        <p className="sheet-form">様式Ⅲ</p>
        <h2 className="sheet-title">
          {s.name}
          <br />
          引率責任者届出書
        </h2>
        <table className="form-table">
          <tbody>
            <tr><th>大学名</th><td>{uni?.name}（{GENDER_LABEL[team.gender]}）</td></tr>
            <tr><th>引率責任者 氏名</th><td>{team.escort.name}</td></tr>
            <tr><th>職名</th><td>{team.escort.title}</td></tr>
            <tr><th>役員登録</th><td>{team.escort.staffMemberId ? "役員として登録済み" : "役員として未登録（ベンチには入れません）"}</td></tr>
          </tbody>
        </table>
        <p className="sheet-declare">
          上記の者は本学の専任教職員、または部長が任命した者であり、本大会の引率責任者として届け出ます。
        </p>
        <div className="sign-area">
          <div className="sign-lines">
            <p>{blankDate}</p>
            <p>大学名　{uni?.name}</p>
            <p>部長　氏名　＿＿＿＿＿＿＿＿＿＿＿＿　印</p>
          </div>
          <div className="seal-box">大学<br />角印</div>
        </div>
      </article>
      )}
    </div>
  );
}
