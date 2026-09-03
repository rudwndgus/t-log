import { AlertCircle, ArrowLeft, Download, Eye, FileText, Image as ImageIcon, LoaderCircle, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { db } from '../../lib/firebase'
import { createAttachmentBlobUrl, getAttachmentManifest, loadAttachment, revokeAttachmentBlobUrl } from '../../services/noteAttachments'
import type { NoteAttachment, NoteBlock } from '../../types'

export interface AttachmentUploadState { state: 'selecting' | 'uploading' | 'ready' | 'error'; progress: number; error?: string; previewUrl?: string }
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export function AttachmentBlock({ tripId, block, upload, onPick }: { tripId: string; block: NoteBlock; upload?: AttachmentUploadState; onPick: () => void }) {
  if (!block.attachmentId || upload?.state === 'selecting') return <button type="button" className="attachment-empty" onClick={onPick}>{block.type === 'image' ? <ImageIcon size={20} /> : <FileText size={20} />}<span>{block.type === 'image' ? '사진 선택' : '파일 선택'}</span></button>
  if (upload?.state === 'uploading') return <div className="attachment-uploading">{upload.previewUrl && block.type === 'image' ? <img src={upload.previewUrl} alt="업로드 중인 이미지" /> : <LoaderCircle className="spin" size={22} />}<span>Firestore에 업로드 중… {Math.round(upload.progress * 100)}%</span><div className="attachment-progress"><span style={{ width: `${upload.progress * 100}%` }} /></div></div>
  if (upload?.state === 'error') return <button type="button" className="attachment-error" onClick={onPick}><AlertCircle size={20} /><span><strong>첨부하지 못했어요</strong><small>{upload.error}</small></span><RotateCcw size={17} /></button>
  return block.type === 'image' ? <ImageAttachment tripId={tripId} attachmentId={block.attachmentId} fallbackUrl={upload?.previewUrl} /> : <FileAttachment tripId={tripId} attachmentId={block.attachmentId} />
}

function ImageAttachment({ tripId, attachmentId, fallbackUrl }: { tripId: string; attachmentId: string; fallbackUrl?: string }) {
  const rootRef = useRef<HTMLButtonElement>(null); const [url, setUrl] = useState(fallbackUrl || ''); const [name, setName] = useState('첨부 이미지'); const [error, setError] = useState(''); const [preview, setPreview] = useState(false)
  useEffect(() => {
    const root = rootRef.current; if (!root || !db || fallbackUrl) return
    let disposed = false; let objectUrl = ''; const observer = new IntersectionObserver((entries) => { if (!entries.some((entry) => entry.isIntersecting)) return; observer.disconnect(); void loadAttachment(db!, tripId, attachmentId).then(({ manifest, blob }) => { if (disposed) return; objectUrl = createAttachmentBlobUrl(blob); setName(manifest.fileName); setUrl(objectUrl) }).catch(() => { if (!disposed) setError('이미지를 불러오지 못했어요.') }) }, { rootMargin: '240px' })
    observer.observe(root); return () => { disposed = true; observer.disconnect(); if (objectUrl) revokeAttachmentBlobUrl(objectUrl) }
  }, [attachmentId, fallbackUrl, tripId])
  return <>{<button ref={rootRef} type="button" className="image-attachment" onClick={() => url && setPreview(true)}>{url ? <img src={url} alt={name} loading="lazy" /> : error ? <span><AlertCircle size={20} />{error}</span> : <span><LoaderCircle className="spin" size={20} />이미지 불러오는 중…</span>}</button>}{preview && <div className="image-preview" role="dialog" aria-label="이미지 크게 보기" onClick={() => setPreview(false)}><button type="button" aria-label="닫기">×</button><img src={url} alt={name} /></div>}</>
}

function FileAttachment({ tripId, attachmentId }: { tripId: string; attachmentId: string }) {
  const [manifest, setManifest] = useState<NoteAttachment | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [preview, setPreview] = useState<{ manifest: NoteAttachment; url: string; text?: string } | null>(null); const urlsRef = useRef<string[]>([]); const previewHistoryRef = useRef(false)
  useEffect(() => { let disposed = false; const urls = urlsRef.current; if (db) void getAttachmentManifest(db, tripId, attachmentId).then((value) => { if (!disposed) setManifest(value) }).catch(() => { if (!disposed) setError('파일 정보를 불러오지 못했어요.') }); return () => { disposed = true; urls.forEach(revokeAttachmentBlobUrl) } }, [attachmentId, tripId])
  useEffect(() => { if (!preview) return; const handleBack = () => { previewHistoryRef.current = false; setPreview(null) }; window.addEventListener('popstate', handleBack); return () => window.removeEventListener('popstate', handleBack) }, [preview])
  const open = async () => {
    if (!db) return
    setLoading(true); setError('')
    try {
      const loaded = await loadAttachment(db, tripId, attachmentId)
      const url = createAttachmentBlobUrl(loaded.blob); urlsRef.current.push(url)
      const canReadText = (/^text\//i.test(loaded.manifest.mimeType) || /application\/(json|xml|javascript)/i.test(loaded.manifest.mimeType)) && loaded.blob.size <= 2 * 1024 * 1024
      window.history.pushState({ ...(window.history.state || {}), tlogFilePreview: true }, '')
      previewHistoryRef.current = true
      setPreview({ manifest: loaded.manifest, url, text: canReadText ? await loaded.blob.text() : undefined })
    } catch { setError('파일을 불러오지 못했어요. 다시 시도해 주세요.') } finally { setLoading(false) }
  }
  const closePreview = () => { setPreview(null); if (previewHistoryRef.current) { previewHistoryRef.current = false; window.history.back() } }
  return <><div className="file-attachment"><span>{manifest?.kind === 'pdf' ? 'PDF' : <FileText size={22} />}</span><div><strong>{manifest?.fileName || '첨부 파일'}</strong><small>{manifest ? `${manifest.kind === 'pdf' ? 'PDF' : manifest.mimeType} · ${fileSize(manifest.storedSize)}` : error || '파일 정보 불러오는 중…'}</small></div><button type="button" onClick={() => void open()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <Eye size={17} />} 미리보기</button>{error && <em>{error}</em>}</div>{preview && <FilePreview preview={preview} onClose={closePreview} />}</>
}

function FilePreview({ preview, onClose }: { preview: { manifest: NoteAttachment; url: string; text?: string }; onClose: () => void }) {
  const { manifest, url, text } = preview
  const isImage = manifest.mimeType.startsWith('image/')
  const isPdf = manifest.kind === 'pdf' || manifest.mimeType === 'application/pdf' || /\.pdf$/i.test(manifest.fileName)
  const isAudio = manifest.mimeType.startsWith('audio/')
  const supported = isImage || isPdf || isAudio || text !== undefined
  return <div className="file-preview" role="dialog" aria-modal="true" aria-label={`${manifest.fileName} 미리보기`}>
    <header><button type="button" onClick={onClose} aria-label="닫기"><ArrowLeft size={21} /></button><div><strong>{manifest.fileName}</strong><small>{fileSize(manifest.storedSize)}</small></div><span className="file-preview__back-label">노트로 돌아가기</span></header>
    <div className="file-preview__body">
      {isImage ? <img src={url} alt={manifest.fileName} /> : isPdf ? <iframe src={url} title={`${manifest.fileName} 미리보기`} /> : isAudio ? <audio src={url} controls /> : text !== undefined ? <pre>{text}</pre> : <div className="file-preview__unsupported"><FileText size={42} /><strong>이 형식은 화면에서 바로 볼 수 없어요.</strong><span>아래 저장 버튼으로 파일을 확인해 주세요.</span></div>}
    </div>
    <footer><a href={url} download={manifest.fileName}><Download size={18} /> 파일 저장</a>{supported && <span>앱 안에서 미리보는 중</span>}</footer>
  </div>
}
