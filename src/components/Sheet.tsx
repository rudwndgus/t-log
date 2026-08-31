import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Sheet({ open, title, onClose, children, tall = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  if (!open) return null
  return <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={title}>
    <button className="sheet-backdrop" onClick={onClose} aria-label="닫기" />
    <section className={`sheet ${tall ? 'sheet--tall' : ''}`}>
      <div className="sheet-grabber" />
      <header className="sheet-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button></header>
      <div className="sheet-body">{children}</div>
    </section>
  </div>
}
