import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export const uid = () => crypto.randomUUID()
export const inviteCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6))).map((n) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('')
export const formatTripDates = (start: string, end: string) => `${format(parseISO(start), 'MMM d', { locale: ko })} – ${format(parseISO(end), 'MMM d', { locale: ko })}`
export const tripDayCount = (start: string, end: string) => Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(start)) + 1)
export const dayLabel = (start: string, index: number) => `Day ${index + 1} · ${format(addDays(parseISO(start), index), 'M월 d일 EEE', { locale: ko })}`
export const timeLabel = (value?: string) => value ? format(new Date(`2000-01-01T${value}`), 'a h:mm', { locale: ko }) : '시간 미정'
export const timeRangeLabel = (start?: string, end?: string) => start && end ? `${timeLabel(start)} ~ ${timeLabel(end)}` : start ? timeLabel(start) : '시간 미정'
export const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')
export const googleMapsUrl = (name: string, lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${lat},${lng}`)}`
export const initials = (name: string) => name.trim().slice(0, 1).toUpperCase()
