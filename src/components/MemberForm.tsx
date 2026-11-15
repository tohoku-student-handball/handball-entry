"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { emptyMember, FOREIGN_LABEL, HANDEDNESS, POSITION_LABEL, POSITIONS, STAFF_TITLES, type ForeignStatus, type Member, type MemberKind, type Team } from "@/lib/types";
import { isInsured, isMinor, validateMember, validateTeam } from "@/lib/validation";
import { ConfirmButton } from "./ConfirmButton";
import { Field } from "./Field";
import { PhotoInput } from "./PhotoInput";
import { go } from "./router";

/** T-2a 選手の追加・編集 / 役員の追加・編集 */
export function MemberForm({ team, kind, memberId }: { team: Team; kind: MemberKind; memberId: string | null }) {
  const store = useStore();
  const s = store.settings();
  const original = memberId ? store.member(memberId) : undefined;
  const [m, setM] = useState<Member>(original ?? emptyMember(team.id, kind));
  const [tried, setTried] = useState(false);
  const back = () => go(team.gender, kind === "player" ? "players" : "staff");

  if (memberId && !original) {
    return (
      <div className="card">
        <p>この{kind === "player" ? "選手" : "役員"}は見つかりませんでした（削除された可能性があります）。</p>
        <button className="btn" onClick={back}>名簿に戻る</button>
      </div>
    );
  }

  const set = <K extends keyof Member>(k: K, v: Member[K]) => setM((cur) => ({ ...cur, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  // 他の選手との関係（背番号重複・人数）も含めてチェックし、この人に関係するものだけを表示
  const others = store.members(team.id).filter((x) => x.id !== m.id);
  const probe = { ...m, id: m.id || "__new__" };
  const teamIssues = validateTeam(team, [...others, probe], s).filter((i) => i.memberId === probe.id && !validateMember(probe, s).some((j) => j.message === i.message));
  const issues = [...validateMember(probe, s), ...teamIssues];
  const shown = tried ? issues : issues.filter((i) => i.field === "number" && i.message.includes("重複"));
  const errorCount = issues.filter((i) => i.level === "error").length;

  const isFull = kind === "staff" || m.isEntry;
  const minor = isMinor(m, s);

  // 上限チェック（新しく追加するとき）
  const entryCount = others.filter((x) => x.kind === "player" && x.isEntry).length;
  const staffCount = others.filter((x) => x.kind === "staff").length;
  const overLimit = kind === "player" ? m.isEntry && entryCount >= s.limits.playerEntryMax : staffCount >= s.limits.staffMax;

  function save(force: boolean) {
    setTried(true);
    if (!m.name.trim()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (overLimit) return;
    if (errorCount > 0 && !force) return;
    store.saveMember(m);
    back();
  }

  async function remove() {
    if (!original) return;
    await store.deleteMember(original.id);
    back();
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      {kind === "player" && (
        <section className="card">
          <h3>掲載の区分</h3>
          <div className="segmented" role="radiogroup">
            <button type="button" className={m.isEntry ? "on" : ""} onClick={() => set("isEntry", true)}>
              エントリー選手（25名）
            </button>
            <button type="button" className={!m.isEntry ? "on" : ""} onClick={() => setM({ ...m, isEntry: false, bench: false })}>
              氏名のみ掲載
            </button>
          </div>
          <p className="hint">エントリー選手は背番号・写真などすべての項目を入力します。それ以外の部員は氏名のみです。</p>
        </section>
      )}

      <section className="card">
        <h3>基本</h3>
        {kind === "staff" && (
          <Field label="役職" required issues={shown} field="title">
            <select value={m.title} onChange={(e) => set("title", e.target.value)}>
              {STAFF_TITLES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="氏名" required issues={shown} field="name" hint="姓と名の間にスペースを入れてください。例：東北 太郎">
          <input value={m.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="ふりがな（ひらがな）" required issues={shown} field="kana" hint="例：とうほく たろう">
          <input value={m.kana} onChange={(e) => set("kana", e.target.value)} autoComplete="off" />
        </Field>
        {kind === "player" && m.isEntry && (
          <Field label="背番号" required issues={shown} field="number" hint={`${s.limits.numberMin}〜${s.limits.numberMax}。チーム内で重複できません。申込後は変更できません。`}>
            <input value={m.number ?? ""} onChange={(e) => set("number", num(e.target.value))} type="number" inputMode="numeric" min={s.limits.numberMin} max={s.limits.numberMax} className="short" />
          </Field>
        )}
        {isFull && (
          <Field label="生年月日" required issues={shown} field="birthDate" hint="保険の加入と、未成年かどうかの確認に使います（パンフレットには載りません）。">
            <input value={m.birthDate} onChange={(e) => set("birthDate", e.target.value)} type="date" />
          </Field>
        )}
        {kind === "player" && (
          <Field label="留学生の区分" issues={shown} field="foreignStatus" hint="短期留学生はエントリーできません。">
            <select value={m.foreignStatus} onChange={(e) => set("foreignStatus", e.target.value as ForeignStatus)}>
              {(Object.keys(FOREIGN_LABEL) as ForeignStatus[]).map((k) => (
                <option key={k} value={k}>
                  {FOREIGN_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </section>

      {kind === "player" && m.isEntry && (
        <section className="card">
          <h3>パンフレット掲載項目</h3>
          <div className="grid2">
            <Field label="学年" required issues={shown} field="grade">
              <select value={m.grade ?? ""} onChange={(e) => set("grade", num(e.target.value))}>
                <option value="">選択</option>
                {[1, 2, 3, 4, 5, 6].map((g) => (
                  <option key={g} value={g}>
                    {g}年
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ポジション" required issues={shown} field="position">
              <select value={m.position} onChange={(e) => set("position", e.target.value)}>
                <option value="">選択</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {POSITION_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="学部" required issues={shown} field="faculty">
            <input value={m.faculty} onChange={(e) => set("faculty", e.target.value)} />
          </Field>
          <Field label="出身高校" required issues={shown} field="highSchool" hint="例：宮城県立〇〇高校（長い場合は「県立」などを省略可）">
            <input value={m.highSchool} onChange={(e) => set("highSchool", e.target.value)} />
          </Field>
          <div className="grid3">
            <Field label="身長(cm)" required issues={shown} field="heightCm">
              <input value={m.heightCm ?? ""} onChange={(e) => set("heightCm", num(e.target.value))} type="number" inputMode="numeric" />
            </Field>
            <Field label="体重(kg)" required issues={shown} field="weightKg">
              <input value={m.weightKg ?? ""} onChange={(e) => set("weightKg", num(e.target.value))} type="number" inputMode="numeric" />
            </Field>
            <Field label="利き手" required issues={shown} field="handedness">
              <select value={m.handedness} onChange={(e) => set("handedness", e.target.value)}>
                <option value="">選択</option>
                {HANDEDNESS.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      )}

      {isFull && (
        <section className="card">
          <h3>顔写真</h3>
          <label className="check">
            <input type="checkbox" checked={m.photoConsent} onChange={(e) => set("photoConsent", e.target.checked)} />
            <span>
              本人が、顔写真を大会パンフレットに掲載することに同意しています
              <br />
              <span className="muted small">写真はパンフレットの作成と大会運営のためだけに使い、大会終了後は全日本学連の規定に従って削除します。</span>
            </span>
          </label>
          {m.photoConsent ? (
            <>
              <PhotoInput value={m.photoKey} onChange={(k) => set("photoKey", k)} rule={s.images.face} />
              {shown.filter((i) => i.field === "photo").map((i, k) => (
                <p key={k} className="msg-error">{i.message}</p>
              ))}
            </>
          ) : (
            <p className="hint">同意がない場合、パンフレットには写真なしで掲載されます。</p>
          )}
        </section>
      )}

      {isFull && (
        <section className="card">
          <h3>ベンチ・保険{kind === "player" && minor ? "・ドーピング検査" : ""}</h3>
          <label className="check">
            <input type="checkbox" checked={m.bench} onChange={(e) => set("bench", e.target.checked)} />
            <span>
              ベンチ登録する
              <br />
              <span className="muted small">
                {kind === "player" ? `選手は${s.limits.benchPlayerMax}名まで（留学生は${s.limits.foreignGameEntryMax}名まで）` : `役員は${s.limits.benchStaffMax}名まで`}
              </span>
            </span>
          </label>
          {kind === "staff" && (
            <>
              <label className="check">
                <input type="checkbox" checked={m.isStudent} onChange={(e) => set("isStudent", e.target.checked)} />
                <span>学生です（学生役員は傷害保険に必ず加入します）</span>
              </label>
              {!m.isStudent && (
                <label className="check">
                  <input type="checkbox" checked={m.insuranceOptIn} onChange={(e) => set("insuranceOptIn", e.target.checked)} />
                  <span>傷害保険に加入する（任意・{s.fees.insurancePerPerson}円）</span>
                </label>
              )}
            </>
          )}
          <p className="hint">傷害保険：{isInsured(m) ? `加入（${s.fees.insurancePerPerson}円）` : "加入しない"}</p>
          {kind === "player" && minor && (
            <div className={"notice" + (tried && !m.dopingConsentChecked ? " notice-error" : "")}>
              <p>
                <strong>大会初日の時点で未成年の選手です。</strong>
                <br />
                保護者のドーピング検査同意書（JHA Web登録システムで提出）を、大会当日に携帯する必要があります。
              </p>
              <label className="check">
                <input type="checkbox" checked={m.dopingConsentChecked} onChange={(e) => set("dopingConsentChecked", e.target.checked)} />
                <span>保護者の同意書を携帯することを確認しました<span className="req">必須</span></span>
              </label>
            </div>
          )}
        </section>
      )}

      {overLimit && (
        <p className="msg-error card">
          {kind === "player" ? `エントリー選手はすでに${s.limits.playerEntryMax}名います。「氏名のみ掲載」にするか、ほかの選手を外してください。` : `役員はすでに${s.limits.staffMax}名います。`}
        </p>
      )}

      {tried && errorCount > 0 && (
        <div className="card issue-box">
          <p className="issue-head error">入力が足りない・ルールに合わない項目が{errorCount}件あります</p>
          <ul>
            {issues.filter((i) => i.level === "error").map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
          <p className="hint">あとで入力する場合は「途中のまま保存」を押してください（提出前にすべて直す必要があります）。</p>
        </div>
      )}

      <div className="actions sticky">
        <button type="button" className="btn" onClick={back}>
          戻る
        </button>
        {tried && errorCount > 0 && !overLimit && m.name.trim() && (
          <button type="button" className="btn" onClick={() => save(true)}>
            途中のまま保存
          </button>
        )}
        <button type="submit" className="btn primary">
          保存する
        </button>
      </div>

      {original && (
        <div className="center-text">
          <ConfirmButton
            label={`この${kind === "player" ? "選手" : "役員"}を削除する`}
            question={`${original.name || "この人"}を名簿から削除します。元に戻せません。`}
            confirmLabel="削除する"
            onConfirm={remove}
          />
        </div>
      )}
    </form>
  );
}
