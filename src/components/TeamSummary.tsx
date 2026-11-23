"use client";
import { usePhotoUrl, useStore } from "@/lib/store";
import { ASSET_LABEL, FOREIGN_LABEL, GENDER_LABEL, type Member, type Team } from "@/lib/types";
import { feeSummary, isInsured, isMinor, sponsorFee } from "@/lib/validation";
import { yen } from "./ui";

/** 申込内容の一覧（提出前の最終確認・地区学連と事務局の確認で使う） */
export function TeamSummary({ team }: { team: Team }) {
  const store = useStore();
  const s = store.settings();
  const members = store.members(team.id);
  const staff = members.filter((m) => m.kind === "staff");
  const entries = members.filter((m) => m.kind === "player" && m.isEntry).sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
  const nameOnly = members.filter((m) => m.kind === "player" && !m.isEntry);
  const uniforms = store.uniforms(team.id);
  const assets = store.assets(team.id);
  const f = store.features();
  const division = store.division(team.divisionId);
  const fees = feeSummary(members, s, { insurance: f.insurance, entryFee: division?.entryFee });
  const sponsor = sponsorFee(uniforms, s);
  const escortStaff = team.escort.staffMemberId ? staff.find((m) => m.personId === team.escort.staffMemberId) : undefined;

  return (
    <div className="stack">
      <section className="card">
        <h3>基本情報</h3>
        <table className="kv left">
          <tbody>
            <tr><th>大学・チーム</th><td>{store.university(team.universityId)?.name}（{GENDER_LABEL[team.gender]}）／表記：{team.displayName}</td></tr>
            <tr><th>{division ? "部" : "地区"}</th><td>{division ? division.name : store.region(team.regionId)?.name}</td></tr>
            <tr><th>連絡担当者</th><td>{team.contactName || "—"}／{team.contactPhone || "—"}／{team.contactEmail || "—"}</td></tr>
            <tr><th>JHA登録番号</th><td>{team.jhaNumber || "—"}{team.registrationConfirmed && <span className="tag ok-tag">事務局確認済</span>}</td></tr>
            <tr><th>全日本学連 登録番号</th><td>{team.studentFedNumber || "—"}</td></tr>
            {f.escort && <tr>
              <th>引率責任者</th>
              <td>
                {team.escort.name || "—"}（{team.escort.title || "職名なし"}）
                {team.escort.qualified ? "・専任教職員等の確認済" : "・資格の確認なし"}
                {!escortStaff && team.escort.name && <span className="tag warn-tag">役員名簿に未登録（ベンチ不可）</span>}
              </td>
            </tr>}
            <tr><th>振込額（見込み）</th><td>{yen(fees.total)}{f.insurance && `（参加料 ${yen(fees.entryFee)}＋保険 ${fees.insured}名 ${yen(fees.insuranceFee)}）`}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>役員（{staff.length}名）</h3>
        <div className="table-wrap">
          <table className="grid-table">
            <thead><tr>{f.pamphlet && <th>写真</th>}<th>役職</th><th>氏名</th><th>ふりがな</th><th>ベンチ</th>{f.insurance && <th>保険</th>}</tr></thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.id}>
                  {f.pamphlet && <td><Thumb m={m} /></td>}
                  <td>{m.title}</td>
                  <td>{m.name}</td>
                  <td>{m.kana}</td>
                  <td>{m.bench ? "○" : ""}</td>
                  {f.insurance && <td>{isInsured(m) ? (m.isStudent ? "加入（学生）" : "加入") : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>エントリー選手（{entries.length}名）</h3>
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>{f.pamphlet && <th>写真</th>}<th>No.</th><th>氏名</th><th>ふりがな</th><th>学年</th><th>Pos</th><th>身長</th><th>体重</th><th>利き手</th><th>出身高校</th><th>学部</th><th>区分</th><th>ベンチ</th></tr>
            </thead>
            <tbody>
              {entries.map((m) => (
                <tr key={m.id}>
                  {f.pamphlet && <td><Thumb m={m} /></td>}
                  <td className="num-cell">{m.number ?? "—"}</td>
                  <td>{m.name}</td>
                  <td>{m.kana}</td>
                  <td>{m.grade ?? "—"}</td>
                  <td>{m.position || "—"}</td>
                  <td>{m.heightCm ?? "—"}</td>
                  <td>{m.weightKg ?? "—"}</td>
                  <td>{m.handedness || "—"}</td>
                  <td>{m.highSchool || "—"}</td>
                  <td>{m.faculty || "—"}</td>
                  <td>
                    {m.foreignStatus !== "none" && FOREIGN_LABEL[m.foreignStatus]}
                    {isMinor(m, s) && <span className="tag">未成年{m.dopingConsentChecked ? "・同意書確認済" : "・同意書未確認"}</span>}
                  </td>
                  <td>{m.bench ? "○" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {nameOnly.length > 0 && (
          <p className="small">
            <strong>氏名のみ掲載（{nameOnly.length}名）：</strong>
            {nameOnly.map((m) => m.name).join("、")}
          </p>
        )}
      </section>

      <section className="card">
        <h3>ユニフォーム</h3>
        {uniforms.length === 0 ? (
          <p className="muted">未登録</p>
        ) : (
          <ul className="plain-list">
            {uniforms.map((u) => (
              <li key={u.id}>
                {u.use}用：{u.color || "（色未入力）"}（{u.tone === "dark" ? "濃色" : "淡色"}）{u.sponsor && <span className="tag">協賛企業名入り</span>}
              </li>
            ))}
          </ul>
        )}
        {sponsor.count > 0 && <p className="small">協賛企業名入り {sponsor.count}着種：当日現金払い {yen(sponsor.amount)}</p>}
      </section>

      {f.pamphlet && (
      <section className="card">
        <h3>集合写真・ロゴ</h3>
        <div className="asset-thumbs">
          {(["group", "logo"] as const).map((k) => {
            const a = assets.find((x) => x.kind === k);
            return <AssetThumb key={k} label={ASSET_LABEL[k]} path={a?.path ?? null} size={a ? `${a.width}×${a.height}px` : ""} />;
          })}
        </div>
      </section>
      )}
    </div>
  );
}

function Thumb({ m }: { m: Member }) {
  const url = usePhotoUrl(m.photoKey);
  return (
    <span className="thumb tiny">
      {url ? <img src={url} alt="" /> : <span>{m.photoConsent ? "なし" : "不可"}</span>}
    </span>
  );
}

function AssetThumb({ label, path, size }: { label: string; path: string | null; size: string }) {
  const url = usePhotoUrl(path);
  return (
    <figure className="asset-thumb">
      <div className="asset-box">{url ? <img src={url} alt={label} /> : <span className="muted small">未提出</span>}</div>
      <figcaption className="small">
        {label} {size && <span className="muted">{size}</span>}
      </figcaption>
    </figure>
  );
}
