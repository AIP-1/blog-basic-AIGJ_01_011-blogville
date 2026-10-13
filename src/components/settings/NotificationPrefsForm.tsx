"use client";

import { useActionState } from "react";
import { updateNotificationPrefs, type NotificationPrefsState } from "@/app/settings/account/actions";
import { NOTIFICATION_PREF_KEYS, NOTIFICATION_PREF_LABELS, type NotificationPrefs } from "@/lib/notifications";

/** 🔔 알림 설정: 받을 알림 종류를 켜고 끈다 */
export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefs }) {
  const [state, action, pending] = useActionState<NotificationPrefsState, FormData>(updateNotificationPrefs, null);
  // 저장한 뒤에는 저장한 값을 보여 준다 (폼이 다시 그려져도 체크가 되돌아가지 않게)
  const current = state?.prefs ?? prefs;
  return (
    <form action={action} className="space-y-3" key={JSON.stringify(current)}>
      <fieldset className="space-y-2">
        <legend className="sr-only">받을 알림</legend>
        {NOTIFICATION_PREF_KEYS.map((key) => (
          <label key={key} className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name={key} defaultChecked={current[key]} className="size-5" />
            <span>{NOTIFICATION_PREF_LABELS[key]}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-ink-soft">🐞 문의 답변 알림은 끌 수 없어요.</p>
      <div className="flex items-center justify-end gap-3">
        {state?.message && (
          <p role="status" className="font-semibold text-accent">
            {state.message}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          저장
        </button>
      </div>
    </form>
  );
}
