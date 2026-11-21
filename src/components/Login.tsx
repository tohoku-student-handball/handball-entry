"use client";
import { useState } from "react";
import type { LiveStore } from "@/lib/liveStore";
import { toMessage } from "@/lib/store";
import { Field } from "./Field";

/** ログイン画面：メールアドレスを入れると、ログイン用のリンクと6桁のコードが届く */
export function Login({ store }: { store: LiveStore }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container narrow">
      <section className="card stack">
        <div>
          <p className="muted small">全日本学生ハンドボール選手権大会</p>
          <h1>申込システムにログイン</h1>
        </div>
        {!sent ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) throw new Error("メールアドレスの形式が正しくありません。");
                await store.requestLogin(email);
                setSent(true);
              });
            }}
          >
            <Field label="メールアドレス" hint="事務局から案内を受け取ったメールアドレスを入力してください。パスワードは不要です。">
              <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button type="submit" className="btn primary block" disabled={busy}>
              {busy ? "送信中…" : "ログイン用のメールを送る"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => store.verifyCode(email, code));
            }}
          >
            <p className="ok-box">
              {email} にメールを送りました。
            </p>
            <p>
              メールの<strong>「ログインする」リンクを開く</strong>か、メールに書かれた<strong>6桁のコード</strong>を下に入力してください。
            </p>
            <Field label="6桁のコード" hint="メールが届かないときは、迷惑メールのフォルダもご確認ください。">
              <input id="login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} className="short" />
            </Field>
            <div className="row">
              <button type="submit" className="btn primary" disabled={busy || code.trim().length < 6}>
                {busy ? "確認中…" : "ログイン"}
              </button>
              <button type="button" className="btn" onClick={() => { setSent(false); setCode(""); }}>
                メールアドレスを入れ直す
              </button>
            </div>
          </form>
        )}
        {error && <p className="msg-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}

/** ログインできたが、どの役割にも登録されていない人 */
export function NotRegistered({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <main className="container narrow">
      <section className="card stack">
        <h1>このメールアドレスは登録されていません</h1>
        <p>
          <strong>{email}</strong> は、今年度の大会の担当者として登録されていません。
          大会事務局、または所属する地区学連にお問い合わせください。
        </p>
        <button className="btn" onClick={onSignOut}>ログアウト</button>
      </section>
    </main>
  );
}
