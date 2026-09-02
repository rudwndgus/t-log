import { Bytes, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, writeBatch, type Firestore } from 'firebase/firestore'
import type { NoteAttachment, NoteBlock } from '../types'

export const ATTACHMENT_CHUNK_SIZE = 640 * 1024
export const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024
const blobCache = new Map<string, Blob>()

export interface PreparedAttachment { blob: Blob; fileName: string; mimeType: string; originalSize: number; width?: number; height?: number }
export interface UploadAttachmentInput { tripId: string; notePageId: string; blockId: string; attachmentId: string; kind: NoteAttachment['kind']; file: File; fileName?: string; createdBy: string; signal?: AbortSignal; onProgress?: (progress: number) => void }

export const chunkAttachmentBytes = (bytes: Uint8Array, size = ATTACHMENT_CHUNK_SIZE) => { const chunks: Uint8Array[] = []; for (let offset = 0; offset < bytes.length; offset += size) chunks.push(bytes.slice(offset, Math.min(offset + size, bytes.length))); return chunks }
export const reassembleAttachmentChunks = (chunks: Uint8Array[]) => { const size = chunks.reduce((total, chunk) => total + chunk.length, 0); const result = new Uint8Array(size); let offset = 0; chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length }); return result }
export const collectAttachmentIds = (blocks: NoteBlock[]): string[] => blocks.flatMap((block) => [block.attachmentId, ...collectAttachmentIds(block.children || [])]).filter((id): id is string => Boolean(id))

const imageDimensions = async (blob: Blob) => {
  if ('createImageBitmap' in window) { const bitmap = await createImageBitmap(blob); const dimensions = { width: bitmap.width, height: bitmap.height }; bitmap.close(); return dimensions }
  return await new Promise<{ width: number; height: number }>((resolve, reject) => { const url = URL.createObjectURL(blob); const image = new Image(); image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url) }; image.onerror = () => { reject(new Error('UNSUPPORTED_IMAGE')); URL.revokeObjectURL(url) }; image.src = url })
}

const decodeImageElement = (blob: Blob) => new Promise<HTMLImageElement>((resolve, reject) => { const url = URL.createObjectURL(blob); const image = new Image(); image.onload = () => { resolve(image); URL.revokeObjectURL(url) }; image.onerror = () => { reject(new Error('UNSUPPORTED_IMAGE')); URL.revokeObjectURL(url) }; image.src = url })

const decodeImage = async (blob: Blob) => {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob) } catch { /* Mobile Safari can expose createImageBitmap but reject camera formats that <img> can decode. */ }
  }
  return decodeImageElement(blob)
}

const isImageBitmapSource = (source: ImageBitmap | HTMLImageElement): source is ImageBitmap => typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap

export async function prepareImageAttachment(file: File): Promise<PreparedAttachment> {
  const heic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
  if (file.size <= 800 * 1024 && !heic) { const dimensions = await imageDimensions(file).catch(() => undefined); return { blob: file, fileName: file.name, mimeType: file.type || 'image/jpeg', originalSize: file.size, ...dimensions } }
  let source: ImageBitmap | HTMLImageElement
  try { source = await decodeImage(file) } catch { throw new Error(heic ? 'UNSUPPORTED_IMAGE' : 'IMAGE_DECODE_FAILED') }
  const sourceWidth = isImageBitmapSource(source) ? source.width : source.naturalWidth; const sourceHeight = isImageBitmapSource(source) ? source.height : source.naturalHeight
  const scale = Math.min(1, 2400 / Math.max(sourceWidth, sourceHeight)); const width = Math.max(1, Math.round(sourceWidth * scale)); const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); if (!context) throw new Error('IMAGE_DECODE_FAILED')
  context.drawImage(source, 0, 0, width, height); if (isImageBitmapSource(source)) source.close()
  const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  const encoded = await encode('image/webp', .86) || await encode('image/jpeg', .88); if (!encoded) throw new Error('IMAGE_ENCODE_FAILED')
  const extension = encoded.type === 'image/webp' ? 'webp' : 'jpg'; const fileName = file.name.replace(/\.[^.]+$/, '') + `.${extension}`
  return { blob: encoded, fileName, mimeType: encoded.type, originalSize: file.size, width, height }
}

export async function prepareAttachment(file: File, kind: NoteAttachment['kind']): Promise<PreparedAttachment> {
  if (file.size > MAX_ATTACHMENT_SIZE) throw new Error('FILE_TOO_LARGE')
  if (file.type.startsWith('video/')) throw new Error('VIDEO_NOT_SUPPORTED')
  if (kind === 'image') {
    if (!file.type.startsWith('image/') && !/\.hei[cf]$/i.test(file.name)) throw new Error('INVALID_IMAGE')
    return prepareImageAttachment(file)
  }
  if (kind === 'pdf' && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new Error('INVALID_PDF')
  return { blob: file, fileName: file.name, mimeType: file.type || 'application/octet-stream', originalSize: file.size }
}

export async function uploadAttachment(database: Firestore, input: UploadAttachmentInput): Promise<NoteAttachment> {
  const prepared = await prepareAttachment(input.file, input.kind); if (prepared.blob.size > MAX_ATTACHMENT_SIZE) throw new Error('FILE_TOO_LARGE')
  const fileName = input.fileName?.trim() || prepared.fileName
  const bytes = new Uint8Array(await prepared.blob.arrayBuffer()); const chunks = chunkAttachmentBytes(bytes); const attachmentRef = doc(database, 'trips', input.tripId, 'attachments', input.attachmentId)
  const manifest = { kind: input.kind, fileName, mimeType: prepared.mimeType, size: prepared.originalSize, storedSize: prepared.blob.size, chunkCount: chunks.length, width: prepared.width || null, height: prepared.height || null, notePageId: input.notePageId, blockId: input.blockId, createdBy: input.createdBy, status: 'uploading', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
  try {
    input.signal?.throwIfAborted(); await setDoc(attachmentRef, manifest)
    for (let index = 0; index < chunks.length; index += 1) { input.signal?.throwIfAborted(); await setDoc(doc(attachmentRef, 'chunks', String(index).padStart(5, '0')), { index, data: Bytes.fromUint8Array(chunks[index]) }); input.onProgress?.((index + 1) / chunks.length) }
    input.signal?.throwIfAborted(); await setDoc(attachmentRef, { status: 'ready', updatedAt: serverTimestamp() }, { merge: true }); blobCache.set(`${input.tripId}/${input.attachmentId}`, prepared.blob)
    return { id: input.attachmentId, tripId: input.tripId, notePageId: input.notePageId, blockId: input.blockId, kind: input.kind, fileName, mimeType: prepared.mimeType, size: prepared.originalSize, storedSize: prepared.blob.size, chunkCount: chunks.length, width: prepared.width, height: prepared.height, status: 'ready', createdBy: input.createdBy, createdAt: new Date().toISOString() }
  } catch (error) { await deleteAttachment(database, input.tripId, input.attachmentId).catch(() => {}); throw error }
}

export async function getAttachmentManifest(database: Firestore, tripId: string, attachmentId: string): Promise<NoteAttachment | null> {
  const snapshot = await getDoc(doc(database, 'trips', tripId, 'attachments', attachmentId)); if (!snapshot.exists()) return null
  const row = snapshot.data(); return { id: attachmentId, tripId, notePageId: String(row.notePageId || ''), blockId: String(row.blockId || ''), kind: row.kind as NoteAttachment['kind'], fileName: String(row.fileName || '첨부 파일'), mimeType: String(row.mimeType || 'application/octet-stream'), size: Number(row.size || 0), storedSize: Number(row.storedSize || 0), chunkCount: Number(row.chunkCount || 0), width: row.width ? Number(row.width) : undefined, height: row.height ? Number(row.height) : undefined, status: row.status === 'ready' ? 'ready' : 'uploading', createdBy: String(row.createdBy || ''), createdAt: '' }
}

export async function loadAttachment(database: Firestore, tripId: string, attachmentId: string) {
  const manifest = await getAttachmentManifest(database, tripId, attachmentId); if (!manifest || manifest.status !== 'ready') throw new Error('ATTACHMENT_NOT_READY')
  const cacheKey = `${tripId}/${attachmentId}`; const cached = blobCache.get(cacheKey); if (cached) return { manifest, blob: cached }
  const snapshots = await getDocs(query(collection(database, 'trips', tripId, 'attachments', attachmentId, 'chunks'), orderBy('index')))
  if (snapshots.size !== manifest.chunkCount) throw new Error('ATTACHMENT_INCOMPLETE')
  const chunks = snapshots.docs.map((snapshot) => (snapshot.data().data as Bytes).toUint8Array()); const blob = new Blob([reassembleAttachmentChunks(chunks)], { type: manifest.mimeType }); blobCache.set(cacheKey, blob); return { manifest, blob }
}

export async function deleteAttachment(database: Firestore, tripId: string, attachmentId: string) {
  blobCache.delete(`${tripId}/${attachmentId}`); const attachmentRef = doc(database, 'trips', tripId, 'attachments', attachmentId); const chunks = (await getDocs(collection(attachmentRef, 'chunks'))).docs
  for (let offset = 0; offset < chunks.length; offset += 450) { const batch = writeBatch(database); chunks.slice(offset, offset + 450).forEach((chunk) => batch.delete(chunk.ref)); await batch.commit() }
  await deleteDoc(attachmentRef)
}

export const createAttachmentBlobUrl = (blob: Blob) => URL.createObjectURL(blob)
export const revokeAttachmentBlobUrl = (url: string) => URL.revokeObjectURL(url)
