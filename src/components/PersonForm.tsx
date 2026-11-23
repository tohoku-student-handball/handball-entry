"use client";
import { useState } from "react";
import { toMessage, useStore } from "@/lib/store";
import {
  emptyPerson,
  FOREIGN_LABEL,
  HANDEDNESS,
  personAsMember,
  POSITION_LABEL,
  POSITIONS,
  STAFF_TITLES,
  type ForeignStatus,
  type Gender,
  type MemberKind,
  type RosterPerson,
} from "@/lib/types";
import { isMinor, validateMember } from "@/lib/validation";
import { ConfirmButton } from "./ConfirmButton";
import { Field } from "./Field";
import { PhotoInput } from "./PhotoInput";
import { go } from "./router";

/** 年度の部員名簿：1人分の追加・編集（人に関する情報。全大会で共通） */
export function PersonForm({
  universityId,
  gender,
  kind,
  personId,
}: {
  universityId: string;
  gender: Gender;
  kind: MemberKind;
  personId: string | null;
}) {
  const store = useStore();
  const s = store.settings();
  const f = store.features();
  const year = store.tournament().academicYear;
  const original = personId ? store.person(personId) : undefined;
  const [p, setP] = useState<RosterPerson>(original ?? emptyPerson(universityId, gender, year, kind));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const back = () => go(gender, "roster");

  if (personId && !original) {
    return (
      <div className="card">
        <p>この人は名簿に見つかりませんでした（削除された可能性があります）。</p>
        <button className="btn" onClick={back}>名簿に戻る</button>
      </div>
    );
  }

  const set = <K extends keyof RosterPerson>(k: K, v: RosterPerson[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const isPlayer = p.kind === "player";

  // 名簿の段階では背番号はないので、背番号の指摘は出さない
  const issues = validateMember(personAsMember(p), s, f).filter((i) => i.field !== "number" && i.field !== "title");
  const shown = tried ? issues : [];
  const errorCount = issues.filter((i) => i.level === "error").length;
  const minor = isMinor(personAsMember(p), s);
  const entered = original ? store.snapshot().entries.some((e) => e.personId === original.id) : false;

  async function save(force: boolean) {
    setTried(true);
    setSaveError(null);
    if (!p.name.trim()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (errorCount > 0 && !force) return;
    setBusy(true);
    try {
      await store.savePerson(p);
      back();
    } catch (e) {
      setSaveError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <p className="hint card">
        ここで入力した内容は、<strong>{year}年度のすべての大会（リーグ戦・全日本など）で共通</strong>です。背番号とベンチ登録は、大会ごとの「エントリー」で決めます。
      </p>

      <section className="card">
        <h3>基本</h3>
        {!isPlayer && (
          <Field label="ふだんの役職" required>
            <select value={p.defaultTitle} onChange={(e) => set("defaultTitle", e.target.value)}>
              {STAFF_TITLES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="氏名" required issues={shown} field="name" hint="姓と名の間にスペースを入れてください。例：東北 太郎">
          <input id="person-name" value={p.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="ふりがな（ひらがな）" required issues={shown} field="kana" hint="例：とうほく たろう">
          <input id="person-kana" value={p.kana} onChange={(e) => set("kana", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="生年月日" required issues={shown} field="birthDate" hint="保険の加入と、未成年かどうかの確認に使います（公開はしません）。">
          <input id="person-birth" value={p.birthDate} onChange={(e) => set("birthDate", e.target.value)} type="date" />
        </Field>
        {isPlayer && (
          <Field label="留学生の区分" issues={shown} field="foreignStatus" hint="短期留学生はエントリーできません。">
            <select value={p.foreignStatus} onChange={(e) => set("foreignStatus", e.target.value as ForeignStatus)}>
              {(Object.keys(FOREIGN_LABEL) as ForeignStatus[]).map((k) => (
                <option key={k} value={k}>
                  {FOREIGN_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!isPlayer && (
          <label className="check">
            <input type="checkbox" checked={p.isStudent} onChange={(e) => set("isStudent", e.target.checked)} />
            <span>学生です（学生役員は、傷害保険がある大会では必ず加入します）</span>
          </label>
        )}
      </section>

      {isPlayer && (
        <section className="card">
          <h3>選手の情報</h3>
          <div className="grid2">
            <Field label="学年" required issues={shown} field="grade">
              <select value={p.grade ?? ""} onChange={(e) => set("grade", num(e.target.value))}>
                <option value="">選択</option>
                {[1, 2, 3, 4, 5, 6].map((g) => (
                  <option key={g} value={g}>
                    {g}年
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ポジション" required issues={shown} field="position">
              <select value={p.position} onChange={(e) => set("position", e.target.value)}>
                <option value="">選択</option>
                {POSITIONS.map((x) => (
                  <option key={x} value={x}>
                    {POSITION_LABEL[x]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="hint">次の項目は、パンフレットがある大会（全日本など）で必要です。</p>
          <Field label="学部" issues={shown} field="faculty">
            <input value={p.faculty} onChange={(e) => set("faculty", e.target.value)} />
          </Field>
          <Field label="出身高校" issues={shown} field="highSchool" hint="例：宮城県立〇〇高校（長い場合は「県立」などを省略可）">
            <input value={p.highSchool} onChange={(e) => set("highSchool", e.target.value)} />
          </Field>
          <div className="grid3">
            <Field label="身長(cm)" issues={shown} field="heightCm">
              <input value={p.heightCm ?? ""} onChange={(e) => set("heightCm", num(e.target.value))} type="number" inputMode="numeric" />
            </Field>
            <Field label="体重(kg)" issues={shown} field="weightKg">
              <input value={p.weightKg ?? ""} onChange={(e) => set("weightKg", num(e.target.value))} type="number" inputMode="numeric" />
            </Field>
            <Field label="利き手" issues={shown} field="handedness">
              <select value={p.handedness} onChange={(e) => set("handedness", e.target.value)}>
                <option value="">選択</option>
                {HANDEDNESS.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      )}

      <section className="card">
        <h3>顔写真</h3>
        <label className="check">
          <input type="checkbox" checked={p.photoConsent} onChange={(e) => set("photoConsent", e.target.checked)} />
          <span>
            本人が、顔写真を大会パンフレットに掲載することに同意しています
            <br />
            <span className="muted small">写真はパンフレットの作成と大会運営のためだけに使い、大会終了後は学連の規定に従って削除します。</span>
          </span>
        </label>
        {p.photoConsent ? (
          <>
            <PhotoInput
              value={p.photoKey}
              rule={s.images.face}
              onSave={async (blob) => set("photoKey", await store.putPersonPhoto(universityId, blob))}
              onRemove={() => set("photoKey", null)}
            />
            {shown.filter((i) => i.field === "photo").map((i, k) => (
              <p key={k} className="msg-error">{i.message}</p>
            ))}
          </>
        ) : (
          <p className="hint">同意がない場合、パンフレットには写真なしで掲載されます。</p>
        )}
      </section>

      {isPlayer && minor && (
        <section className={"card notice" + (tried && !p.dopingConsentChecked ? " notice-error" : "")}>
          <p>
            <strong>大会初日の時点で未成年の選手です。</strong>
            <br />
            保護者のドーピング検査同意書（JHA Web登録システムで提出）を、大会当日に携帯する必要があります。
          </p>
          <label className="check">
            <input type="checkbox" checked={p.dopingConsentChecked} onChange={(e) => set("dopingConsentChecked", e.target.checked)} />
            <span>保護者の同意書を携帯することを確認しました<span className="req">必須</span></span>
          </label>
        </section>
      )}

      {f.matches && (
        <p className="hint card">
          リーグ戦の<strong>試合記録（氏名・大学・背番号・得点などの成績）は、公開ページで公開</strong>されます。本人に伝えたうえで登録してください。
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
          <p className="hint">あとで入力する場合は「途中のまま保存」を押してください（エントリーして提出する前に直す必要があります）。</p>
        </div>
      )}
      {saveError && <p className="msg-error card" role="alert">{saveError}</p>}

      <div className="actions sticky">
        <button type="button" className="btn" onClick={back}>
          戻る
        </button>
        {tried && errorCount > 0 && p.name.trim() && (
          <button type="button" className="btn" onClick={() => save(true)} disabled={busy}>
            途中のまま保存
          </button>
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "保存中…" : "保存する"}
        </button>
      </div>

      {original && original.active && (
        <div className="center-text">
          <ConfirmButton
            label={entered ? "名簿から外す（退部など）" : "名簿から削除する"}
            question={
              entered
                ? `${original.name || "この人"}を名簿から外します。すでにエントリーした大会の記録は残ります。`
                : `${original.name || "この人"}を名簿から削除します。元に戻せません。`
            }
            confirmLabel={entered ? "外す" : "削除する"}
            onConfirm={async () => {
              await store.removePerson(original.id);
              back();
            }}
          />
        </div>
      )}
      {original && !original.active && (
        <div className="center-text">
          <button type="button" className="btn" onClick={() => store.savePerson({ ...original, active: true }).then(back)}>
            名簿に戻す
          </button>
        </div>
      )}
    </form>
  );
}
