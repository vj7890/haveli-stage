import type { Metadata } from 'next'
import BlockingClient from '@/components/blocking/blocking-client'
import './blocking.css'

export const metadata: Metadata = { title: 'Scene blocking — Haveli stage' }

export default function BlockingPage() {
  return <BlockingClient />
}
