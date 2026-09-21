import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
