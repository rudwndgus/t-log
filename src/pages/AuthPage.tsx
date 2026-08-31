import { ChevronLeft, LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { useApp } from '../context/AppContext'

const friendlyError = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code.includes('email-already-in-use')) return '이미 가입된 이메일이에요.'
  if (code.includes('invalid-credential')) return '이메일 또는 비밀번호를 확인해 주세요.'
  if (code.includes('weak-password')) return '비밀번호는 6자 이상이어야 해요.'
  if (code.includes('too-many-requests')) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  return '계정 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export function AuthPage() {
  const navigate = useNavigate(); const { cloudMode, signedIn, profile, signIn, signUp, signOut } = useApp()
  const [mode, setMode] = useState<'login' | 'signup'>('login'); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { if (mode === 'signup') await signUp(name, email, password); else await signIn(email, password); navigate('/') } catch (reason) { setError(friendlyError(reason)) } finally { setLoading(false) } }
  return <div className="app-shell form-shell"><header className="simple-header"><Link to="/" className="icon-button"><ChevronLeft size={24} /></Link><h1>계정</h1><span /></header><div className="screen-form"><div className="intro-copy"><span className="outline-icon"><LockKeyhole size={27} /></span><h2>{signedIn ? `${profile.name}님, 반가워요` : mode === 'login' ? '다시 여행을 이어가세요' : 'T Log 시작하기'}</h2><p>{signedIn ? profile.email : 'Firebase 계정으로 여행 데이터를 안전하게 저장하고 친구와 공유해요.'}</p></div>{!cloudMode ? <div className="local-notice"><p><strong>Firebase 설정이 필요해요</strong>환경 변수를 연결하기 전에는 이 기기의 IndexedDB에 저장됩니다.</p></div> : signedIn ? <Button full variant="secondary" onClick={() => void signOut()}>로그아웃</Button> : <><div className="auth-tabs"><button className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setError('') }}>로그인</button><button className={mode === 'signup' ? 'is-active' : ''} onClick={() => { setMode('signup'); setError('') }}>회원가입</button></div><form className="auth-form" onSubmit={submit}>{mode === 'signup' && <label className="field"><span>이름</span><input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="여행에서 사용할 이름" /></label>}<label className="field"><span>이메일</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label className="field"><span>비밀번호</span><input required minLength={6} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6자 이상" /></label>{error && <p className="form-error">{error}</p>}<Button full type="submit" loading={loading}>{mode === 'login' ? '로그인' : '계정 만들기'}</Button></form></>}</div></div>
}
