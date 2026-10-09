import type { Metadata } from 'next'
import StageSetup from '@/components/blocking/stage-setup'

export const metadata: Metadata = { title: 'Stage setup — Haveli' }

export default function BlockingPage() {
  return <StageSetup />
}
