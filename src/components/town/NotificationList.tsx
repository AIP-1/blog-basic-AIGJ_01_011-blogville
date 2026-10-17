import Link from "next/link";
import { openNotification } from "@/app/notifications/actions";
import type { HudNotification } from "@/server/town";

/**
 * 최근 알림 5개 (☰ 🔔 알림·내 우체통·휴대폰 광장의 내 우체통이 같이 쓴다, TOWN-12·13).
 * 누르면 읽음으로 바꾸고 그 글로 간다. 안 읽은 알림은 햇빛 바탕에 굵게, 화면 낭독기에는 `안 읽음,`.
 */
export function NotificationList({ notifications }: { notifications: readonly HudNotification[] }) {
  return (
    <div className="space-y-2">
      {notifications.length === 0 ? (
        <p className="text-(--kit-ink-soft)">아직 알림이 없어요.</p>
      ) : (
        <ol className="grid gap-1" aria-label="최근 알림">
          {notifications.map((n) => (
            <li key={n.id}>
              <form action={openNotification}>
                <input type="hidden" name="id" value={n.id} />
                <button
                  type="submit"
                  className={`flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                    n.read ? "bg-(--kit-paper-2)/60 hover:bg-(--kit-paper-2)" : "bg-(--kit-glow)/35 font-bold hover:bg-(--kit-glow)/55"
                  }`}
                  data-notification={n.read ? "read" : "unread"}
                >
                  <span>
                    {!n.read && <span className="sr-only">안 읽음, </span>}
                    {n.text}
                  </span>
                  {/* 햇빛 바탕 위에서는 어두운 화면에서도 대비가 맞게 먹색 그대로 */}
                  <span className={`text-xs font-normal ${n.read ? "text-(--kit-ink-soft)" : ""}`}>{n.time}</span>
                </button>
              </form>
            </li>
          ))}
        </ol>
      )}
      <Link href="/notifications" className="px-btn px-btn--quiet px-btn--sm">
        알림함 전체 보기 ›
      </Link>
    </div>
  );
}
