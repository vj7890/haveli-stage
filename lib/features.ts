import { Box, Map, Watch } from 'lucide-react'

/**
 * The site's features — one entry per page. The menu on every page and the
 * cards on the home page both read this list, so adding a page is one line.
 */
export const FEATURES = [
  { href: '/stage', label: '3D stage', blurb: 'Content on the back LED at its real size, six moving heads, a shareable look.', Icon: Box },
  { href: '/blocking', label: 'Scene blocking', blurb: 'Who is where on the stage and in the hall, cue by cue, exported as plans.', Icon: Map },
  { href: '/wristbands', label: 'Wristbands', blurb: 'The RFID wristbands from above: nine zones painted onto the seats, a colour and an effect each.', Icon: Watch },
] as const

export type Feature = (typeof FEATURES)[number]
