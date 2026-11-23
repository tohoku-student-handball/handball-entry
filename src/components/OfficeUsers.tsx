"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { GENDER_LABEL, ROLE_LABEL, type Gender, type Membership, type Role } from "@/lib/types";
import { ConfirmButton } from "./ConfirmButton";
import { Field } from "./Field";
import { ActionButton, formatDateTime } from "./ui";

/** A-4 大学の登録と、担当者（チーム・地区学連・事務局）の登録・招待 */
export function OfficeUsers() {
  const store = useStore();
  const regions = store.regions();
  const [uniName, setUniName] = useState("");
  const [uniKana, setUniKana] = useState("");
  const [uniRegion, setUniRegion] = useState(regions[0]?.id ?? "");
  const tour = store.tournament();
  const isLeague = tour.kind === "league";
  const menDivs = store.divisions("men");
  const womenDivs = store.divisions("women");
  const [uniMen, setUniMen] = useState("");
  const [uniWomen, setUniWomen] = useState("");
  const roleOptions: Role[] = tour.reviewFlow === "two_step" ? ["team", "region", "office"] : ["team", "office"];

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("team");
  const [target, setTarget] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const tus = store.tournamentUniversities();
  const memberships = store.allMemberships();
  const targetLabel = (m: Membership) =>
    m.role === "team" ? store.university(m.universityId ?? "")?.name : m.role === "region" ? `${store.region(m.regionId ?? "")?.name}地区` : "—";

  return (
    <div className="stack">
      <section className="card stack">
        <h3>参加大学の登録</h3>
        <p className="hint">
          この大会に参加する大学と、その所属{isLeague ? "の部" : "地区"}を登録します。チームの担当者は、ここで登録した大学のチームだけを作れます。
        </p>
        <div className="grid3 wide-first">
          <Field label="大学名">
            <input id="uni-name" value={uniName} onChange={(e) => setUniName(e.target.value)} placeholder="例：東北学院大学" />
          </Field>
          <Field label="ふりがな（カタカナ）">
            <input id="uni-kana" value={uniKana} onChange={(e) => setUniKana(e.target.value)} placeholder="例：トウホクガクインダイガク" />
          </Field>
          {regions.length > 1 ? (
            <Field label="所属地区">
              <select id="uni-region" value={uniRegion} onChange={(e) => setUniRegion(e.target.value)}>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
          ) : (
            <span />
          )}
        </div>
        {isLeague && (
          <div className="grid2">
            <DivisionSelect id="uni-men-div" label="男子の部" value={uniMen} options={menDivs} onChange={setUniMen} />
            <DivisionSelect id="uni-women-div" label="女子の部" value={uniWomen} options={womenDivs} onChange={setUniWomen} />
          </div>
        )}
        <div>
          <ActionButton
            onClick={async () => {
              await store.addUniversity(uniName, uniKana, uniRegion || regions[0]?.id, uniMen || null, uniWomen || null);
              setUniName("");
              setUniKana("");
            }}
          >
            大学を登録する
          </ActionButton>
        </div>
        <details open={isLeague}>
          <summary>登録済みの大学（{tus.length}校）</summary>
          {isLeague ? (
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr><th>大学</th><th>男子の部</th><th>女子の部</th></tr>
                </thead>
                <tbody>
                  {tus
                    .map((tu) => ({ tu, name: store.university(tu.universityId)?.name ?? "" }))
                    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
                    .map(({ tu, name }) => (
                      <tr key={tu.universityId}>
                        <td>{name}</td>
                        {(["men", "women"] as Gender[]).map((g) => (
                          <td key={g}>
                            <select
                              aria-label={`${name}の${GENDER_LABEL[g]}の部`}
                              value={(g === "men" ? tu.menDivisionId : tu.womenDivisionId) ?? ""}
                              onChange={(e) => store.setUniversityDivision(tu.universityId, g, e.target.value || null)}
                            >
                              <option value="">参加しない</option>
                              {store.divisions(g).map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="plain-list small">
              {tus
                .map((tu) => ({ tu, name: store.university(tu.universityId)?.name ?? "" }))
                .sort((a, b) => a.name.localeCompare(b.name, "ja"))
                .map(({ tu, name }) => (
                  <li key={tu.universityId}>
                    {name}（{store.region(tu.regionId)?.name}）
                  </li>
                ))}
            </ul>
          )}
        </details>
      </section>

      <section className="card stack">
        <h3>担当者の登録と招待</h3>
        <p className="hint">
          登録したメールアドレスにログイン用のメールが届き、その人はログインすると担当範囲の画面だけを見られます。
          担当者が交代したら、新しい人を登録して、前の人を削除してください。
        </p>
        <div className="grid2">
          <Field label="メールアドレス">
            <input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="氏名・肩書き（一覧での表示用）">
            <input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：東北学院大学 主務" />
          </Field>
          <Field label="役割">
            <select id="member-role" value={role} onChange={(e) => { setRole(e.target.value as Role); setTarget(""); }}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </Field>
          {role !== "office" && (
            <Field label={role === "team" ? "担当する大学" : "担当する地区"}>
              <select id="member-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">選択してください</option>
                {role === "team"
                  ? tus
                      .map((tu) => store.university(tu.universityId))
                      .filter((u) => !!u)
                      .sort((a, b) => a!.name.localeCompare(b!.name, "ja"))
                      .map((u) => <option key={u!.id} value={u!.id}>{u!.name}</option>)
                  : regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div>
          <ActionButton
            onClick={async () => {
              if (role !== "office" && !target) throw new Error(role === "team" ? "担当する大学を選んでください。" : "担当する地区を選んでください。");
              await store.addMembership({
                email,
                role,
                displayName: name,
                universityId: role === "team" ? target : null,
                regionId: role === "region" ? target : null,
              });
              setNotice(`${email} を登録しました。一覧の「招待メールを送る」を押すと、ログイン用のメールが届きます。`);
              setEmail("");
              setName("");
            }}
          >
            登録する
          </ActionButton>
        </div>
        {notice && <p className="ok-box">{notice}</p>}
      </section>

      <section className="card flush">
        <h3 className="pad">登録済みの担当者（{memberships.length}名）</h3>
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr><th>氏名・肩書き</th><th>メールアドレス</th><th>役割</th><th>担当</th><th>招待メール</th><th></th></tr>
            </thead>
            <tbody>
              {[...memberships]
                .sort((a, b) => a.role.localeCompare(b.role) || (targetLabel(a) ?? "").localeCompare(targetLabel(b) ?? "", "ja"))
                .map((m) => (
                  <tr key={m.id}>
                    <td>{m.displayName || "—"}</td>
                    <td className="small">{m.email}</td>
                    <td>{ROLE_LABEL[m.role]}</td>
                    <td>{targetLabel(m)}</td>
                    <td>
                      <ActionButton className="btn small-btn" onClick={() => store.sendLoginLink(m.email)} busyLabel="送信中…">
                        {m.invitedAt ? "再送する" : "招待メールを送る"}
                      </ActionButton>
                      {m.invitedAt && <span className="muted small block">送信：{formatDateTime(m.invitedAt)}</span>}
                    </td>
                    <td>
                      {m.email !== store.email() && (
                        <ConfirmButton label="削除" question={`${m.email}（${ROLE_LABEL[m.role]}）を削除します。この人は画面を見られなくなります。`} confirmLabel="削除する" onConfirm={() => store.removeMembership(m.id)} />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DivisionSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: { id: string; name: string }[]; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">参加しない</option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </Field>
  );
}
