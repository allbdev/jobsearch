import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from '../lib/cx'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx('input', className)} {...rest} />
})

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx('input', className)} {...rest} />
})
