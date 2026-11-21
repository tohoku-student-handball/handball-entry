"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Team, Uniform, UniformTone, UniformUse } from "@/lib/types";
import { lockReason, sponsorFee, validateUniforms } from "@/lib/validation";
import { IssueList } from "./Field";
import { go } from "./router";
import { ActionButton, LockBanner, yen } from "./ui";

const USES: { use: UniformUse; label: string }[] = [
  { use: "CP", label: "CP（コートプレーヤー）用" },
  { use: "GK", label: "GK（ゴールキーパー）用" },
];

/** T-4 ユニフォーム：CP用・GK用それぞれ濃色と淡色を1着以上 */
export function UniformForm({ team }: { team: Team }) {
  const store = useStore();
  const s = store.settings();
  const locked = lockReason(team, s);
  const initial = store.uniforms(team.id);
  const [list, setList] = useState<Uniform[]>(
    initial.length
      ? initial
      : USES.flatMap(({ use }) =>
          (["dark", "light"] as UniformTone[]).map((tone) => ({ id: "", teamId: team.id, use, tone, color: "", sponsor: false })),
        ),
  );
  const issues = validateUniforms(list);
  const sponsor = sponsorFee(list, s);

  const update = (i: number, patch: Partial<Uniform>) => setList(list.map((u, k) => (k === i ? { ...u, ...patch } : u)));
  const add = (use: UniformUse) => setList([...list, { id: "", teamId: team.id, use, tone: "dark", color: "", sponsor: false }]);
  const remove = (i: number) => setList(list.filter((_, k) => k !== i));

  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()}>
      <LockBanner reason={locked} />
      <p className="hint card">
        CP用・GK用それぞれ、<strong>濃い色と淡い色の2色以上</strong>が必要です。協賛企業名が入っているユニフォームは、1着種ごとに{yen(s.fees.sponsorUniform)}を大会当日に現金でお支払いいただきます。
      </p>
      <fieldset className="plain stack" disabled={!!locked}>
        {USES.map(({ use, label }) => (
          <section key={use} className="card">
            <h3>{label}</h3>
            <div className="uniform-rows">
              {list.map((u, i) =>
                u.use !== use ? null : (
                  <div key={i} className="uniform-row">
                    <label className="uniform-color">
                      <span className="field-label">色の名前</span>
                      <input id={`uniform-color-${i}`} value={u.color} placeholder="例：紺、白、赤" onChange={(e) => update(i, { color: e.target.value })} />
                    </label>
                    <div className="segmented small-seg" role="radiogroup" aria-label="濃淡">
                      <button type="button" className={u.tone === "dark" ? "on" : ""} onClick={() => update(i, { tone: "dark" })}>
                        濃い色
                      </button>
                      <button type="button" className={u.tone === "light" ? "on" : ""} onClick={() => update(i, { tone: "light" })}>
                        淡い色
                      </button>
                    </div>
                    <label className="check compact">
                      <input type="checkbox" checked={u.sponsor} onChange={(e) => update(i, { sponsor: e.target.checked })} />
                      <span>協賛企業名入り</span>
                    </label>
                    <button type="button" className="btn link danger" onClick={() => remove(i)}>
                      削除
                    </button>
                  </div>
                ),
              )}
            </div>
            <button type="button" className="btn" onClick={() => add(use)}>
              ＋ {use}用を追加
            </button>
          </section>
        ))}
      </fieldset>

      {sponsor.count > 0 && (
        <p className="notice">
          協賛企業名入り：{sponsor.count}着種 × {yen(s.fees.sponsorUniform)} = <strong>{yen(sponsor.amount)}</strong>（大会当日に現金でお支払いください）
        </p>
      )}
      <IssueList issues={issues} empty="CP用・GK用ともに濃色・淡色がそろっています。" />

      <div className="actions sticky">
        <button type="button" className="btn" onClick={() => go(team.gender)}>
          戻る
        </button>
        {!locked && (
          <ActionButton
            onClick={async () => {
              await store.saveUniforms(team.id, list);
              go(team.gender);
            }}
            busyLabel="保存中…"
          >
            保存する
          </ActionButton>
        )}
      </div>
    </form>
  );
}
