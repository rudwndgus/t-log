import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { classNames } from '../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; full?: boolean; loading?: boolean; children: ReactNode }
export function Button({ variant = 'primary', full, loading, className, disabled, children, ...props }: ButtonProps) {
  return <button className={classNames('button', `button--${variant}`, full && 'button--full', className)} disabled={disabled || loading} {...props}>{loading && <LoaderCircle size={16} className="spin" />}{children}</button>
}
