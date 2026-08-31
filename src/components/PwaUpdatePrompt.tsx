import { RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000
let updateChecksStarted = false

export function PwaUpdatePrompt() {
  const [updating, setUpdating] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration || updateChecksStarted) return
      updateChecksStarted = true
      const checkForUpdate = () => { if (navigator.onLine) void registration.update() }
      window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate() })
    }
  })

  if (!needRefresh) return null
  const applyUpdate = async () => {
    setUpdating(true)
    window.dispatchEvent(new CustomEvent('tlog:before-update'))
    await new Promise((resolve) => window.setTimeout(resolve, 900))
    await updateServiceWorker(true)
  }

  return <aside className="update-prompt" role="alertdialog" aria-labelledby="update-title" aria-describedby="update-description">
    <span className="update-prompt__icon"><RefreshCw size={20} className={updating ? 'spin' : ''} /></span>
    <div className="update-prompt__copy"><strong id="update-title">새 버전이 준비됐어요</strong><span id="update-description">확인하면 저장 후 최신 T Log로 업데이트해요.</span></div>
    <button className="update-prompt__confirm" onClick={() => void applyUpdate()} disabled={updating}>{updating ? '업데이트 중' : '확인'}</button>
    {!updating && <button className="update-prompt__close" onClick={() => setNeedRefresh(false)} aria-label="나중에 업데이트"><X size={17} /></button>}
  </aside>
}
