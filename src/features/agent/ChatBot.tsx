import { useState } from 'react'
import { AiPanel } from './AiPanel'
import { AiIcon, CloseIcon } from '../../components/ui/icons'
import { useT } from '../../lib/i18n'

// Floating toggle chatbot widget (bottom-right): lightweight quick Q&A popup.
export function ChatBot({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false)
  const t = useT()
  return open ? (
    <div className="chatbot-popup glass" role="dialog" aria-label={t('지식 어시스턴트', 'Knowledge assistant')}>
      <button
        className="icon-btn small chatbot-close"
        onClick={() => setOpen(false)}
        aria-label={t('닫기', 'Close')}
      >
        <CloseIcon />
      </button>
      <AiPanel groupId={groupId} />
    </div>
  ) : (
    <button
      className="chatbot-fab"
      onClick={() => setOpen(true)}
      title={t('지식 어시스턴트', 'Knowledge assistant')}
      aria-label={t('지식 어시스턴트', 'Knowledge assistant')}
    >
      <AiIcon />
    </button>
  )
}
