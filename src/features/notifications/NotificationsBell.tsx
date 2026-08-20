import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { BellIcon } from '../../components/ui/icons'
import { useT } from '../../lib/i18n'
import { listNotifications, markAllRead, type Notification } from './notifications'

export function NotificationsBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()
  const unread = items.filter((n) => !n.read).length

  useEffect(() => {
    if (!userId) return
    listNotifications(userId).then(setItems).catch(() => {})
    const ch = supabase
      .channel(`notif:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => listNotifications(userId).then(setItems).catch(() => {}),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [userId])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      markAllRead(userId).catch(() => {})
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  return (
    <div className="notif" ref={ref}>
      <button className="icon-btn small notif-btn" onClick={toggle} title={t('알림', 'Notifications')} aria-label={t('알림', 'Notifications')}>
        <BellIcon />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-menu glass">
          <div className="notif-head">{t('알림', 'Notifications')}</div>
          {items.length === 0 ? (
            <p className="notif-empty">{t('새 알림이 없어요.', 'No new notifications.')}</p>
          ) : (
            <div className="notif-list">
              {items.map((n) => (
                <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                  <span className="notif-title">{n.title}</span>
                  {n.body && <span className="notif-body">{n.body}</span>}
                  <span className="notif-time">
                    {new Date(n.created_at).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
