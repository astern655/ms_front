import { useState } from 'react'
import { AiPanel } from './AiPanel'
import { AiIcon, CloseIcon } from './icons'

// Floating toggle chat widget (bottom-right). Wraps the agent panel in a small popup.
// teamId (when in a call) scopes the persistent session.
export function ChatBot({ groupId, teamId = null }: { groupId: string; teamId?: string | null }) {
  const [open, setOpen] = useState(false)
  return open ? (
    <div className="chatbot-popup glass" role="dialog" aria-label="지식 어시스턴트">
      <button
        className="icon-btn small chatbot-close"
        onClick={() => setOpen(false)}
        aria-label="닫기"
      >
        <CloseIcon />
      </button>
      <AiPanel groupId={groupId} teamId={teamId} />
    </div>
  ) : (
    <button className="chatbot-fab" onClick={() => setOpen(true)} title="지식 어시스턴트" aria-label="지식 어시스턴트">
      <AiIcon />
    </button>
  )
}
