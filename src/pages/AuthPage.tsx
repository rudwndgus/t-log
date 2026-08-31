import { ChevronLeft, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { useApp } from '../context/AppContext'

export function AuthPage() {
  const { cloudMode, signedIn, profile, signInWithEmail, signOut } = useApp()
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { await signInWithEmail(email); setSent(true) } catch { setError('로그인 링크를 보내지 못했어요. Supabase 이메일 설정을 확인해 주세요.') } finally { setLoading(false) } }
  return <div className="app-shell form-shell"><header className="simple-header"><Link to="/" className="icon-button"><ChevronLeft size={24} /></Link><h1>계정</h1><span /></header><div className="screen-form"><div className="intro-copy"><span className="outline-icon"><Mail size={27} /></span><h2>{signedIn ? `${profile.name}님, 반가워요` : '여행을 안전하게 보관하세요'}</h2><p>{signedIn ? profile.email : '이메일로 받은 링크를 누르면 비밀번호 없이 로그인돼요.'}</p></div>{!cloudMode ? <div className="local-notice"><p><strong>Supabase 설정이 필요해요</strong>환경 변수를 연결하기 전에는 로컬 모드로 사용할 수 있습니다.</p></div> : signedIn ? <Button full variant="secondary" onClick={() => void signOut()}>로그아웃</Button> : sent ? <div className="success-panel"><span className="success-check">✓</span><strong>이메일을 확인해 주세요</strong><span>{email}로 로그인 링크를 보냈어요.</span><Button variant="ghost" onClick={() => setSent(false)}>다른 이메일 사용</Button></div> : <form className="auth-form" onSubmit={submit}><label className="field"><span>이메일</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>{error && <p className="form-error">{error}</p>}<Button full type="submit" loading={loading}>로그인 링크 받기</Button></form>}</div></div>
}
