import type { Metadata } from 'next'
import WristbandEmulator from '@/components/wristbands/wristband-emulator'

export const metadata: Metadata = { title: 'Wristbands — Haveli stage' }

export default function WristbandsPage() {
  return <WristbandEmulator />
}
