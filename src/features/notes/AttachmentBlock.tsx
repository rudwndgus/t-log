import { AlertCircle, Download, FileText, Image as ImageIcon, LoaderCircle, RotateCcw } from 'lucide-react'
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
  const [manifest, setManifest] = useState<NoteAttachment | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const urlsRef = useRef<string[]>([])
  useEffect(() => { let disposed = false; const urls = urlsRef.current; if (db) void getAttachmentManifest(db, tripId, attachmentId).then((value) => { if (!disposed) setManifest(value) }).catch(() => { if (!disposed) setError('파일 정보를 불러오지 못했어요.') }); return () => { disposed = true; urls.forEach(revokeAttachmentBlobUrl) } }, [attachmentId, tripId])
  const open = async () => { if (!db) return; setLoading(true); setError(''); try { const { blob } = await loadAttachment(db, tripId, attachmentId); const url = createAttachmentBlobUrl(blob); urlsRef.current.push(url); window.open(url, '_blank', 'noopener,noreferrer') } catch { setError('파일을 불러오지 못했어요. 다시 시도해 주세요.') } finally { setLoading(false) } }
  return <div className="file-attachment"><span>{manifest?.kind === 'pdf' ? 'PDF' : <FileText size={22} />}</span><div><strong>{manifest?.fileName || '첨부 파일'}</strong><small>{manifest ? `${manifest.kind === 'pdf' ? 'PDF' : manifest.mimeType} · ${fileSize(manifest.storedSize)}` : error || '파일 정보 불러오는 중…'}</small></div><button type="button" onClick={() => void open()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />} 열기</button>{error && <em>{error}</em>}</div>
}
