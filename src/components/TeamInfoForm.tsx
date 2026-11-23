"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Team } from "@/lib/types";
import { lockReason, validateTeam } from "@/lib/validation";
import { Field } from "./Field";
import { go } from "./router";
import { ActionButton, LockBanner } from "./ui";

/** T-1 基本情報・登録番号・引率責任者 */
export function TeamInfoForm({ team }: { team: Team }) {
  const store = useStore();
  const [t, setT] = useState<Team>(team);
  const f = store.features();
  // 引率責任者の候補：部員名簿の役員（大会をまたいで同じ人を指すので、名簿の人の id で持つ）
  const staff = store.roster(team.universityId, team.gender).filter((p) => p.kind === "staff" && p.active);
  const issues = validateTeam(t, store.members(team.id), store.settings(), f).filter((i) => !i.memberId);
  const set = <K extends keyof Team>(k: K, v: Team[K]) => setT({ ...t, [k]: v });
  const setEscort = (patch: Partial<Team["escort"]>) => setT({ ...t, escort: { ...t.escort, ...patch } });

  const locked = lockReason(team, store.settings());

  async function save() {
    await store.saveTeam(t);
    go(t.gender);
  }

  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()}>
      <LockBanner reason={locked} />
      <fieldset className="plain stack" disabled={!!locked}>
      <section className="card">
        <h3>チームの表記</h3>
        <Field label="パンフレットに載せるチーム名" required hint="通常は大学名のままで構いません。">
          <input value={t.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </Field>
      </section>

      <section className="card">
        <h3>連絡担当者</h3>
        <Field label="氏名" required issues={issues} field="contact">
          <input value={t.contactName} onChange={(e) => set("contactName", e.target.value)} autoComplete="name" />
        </Field>
        <Field label="電話番号（日中つながる番号）" required>
          <input value={t.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} type="tel" autoComplete="tel" />
        </Field>
        <Field label="メールアドレス" required hint="提出完了・差し戻しなどのお知らせが届きます。">
          <input value={t.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} type="email" autoComplete="email" />
        </Field>
      </section>

      <section className="card">
        <h3>登録番号</h3>
        <Field label="JHA（日本ハンドボール協会）チーム登録番号" required issues={issues} field="jha" hint="登録が完了しているかは、事務局が確認します。">
          <input value={t.jhaNumber} onChange={(e) => set("jhaNumber", e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="全日本学連 登録番号" required issues={issues} field="fed">
          <input value={t.studentFedNumber} onChange={(e) => set("studentFedNumber", e.target.value)} />
        </Field>
      </section>

      {f.escort && (
      <section className="card">
        <h3>引率責任者（様式Ⅲ）</h3>
        <Field label="氏名" required issues={issues} field="escort">
          <input value={t.escort.name} onChange={(e) => setEscort({ name: e.target.value })} />
        </Field>
        <Field label="職名" hint="例：教授、准教授、職員、部長任命">
          <input value={t.escort.title} onChange={(e) => setEscort({ title: e.target.value })} />
        </Field>
        <Field label="役員名簿との対応" hint="役員名簿に登録されていない人は、ベンチに入れません。">
          <select value={t.escort.staffMemberId ?? ""} onChange={(e) => setEscort({ staffMemberId: e.target.value || null })}>
            <option value="">役員名簿に登録していない</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.defaultTitle}：{p.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="check">
          <input type="checkbox" checked={t.escort.qualified} onChange={(e) => setEscort({ qualified: e.target.checked })} />
          <span>大学の専任教職員、または部長が任命した者です<span className="req">必須</span></span>
        </label>
      </section>
      )}

      </fieldset>
      <div className="actions">
        <button type="button" className="btn" onClick={() => go(t.gender)}>
          {locked ? "戻る" : "保存せずに戻る"}
        </button>
        {!locked && (
          <ActionButton type="submit" onClick={save} busyLabel="保存中…">
            保存する
          </ActionButton>
        )}
      </div>
    </form>
  );
}
