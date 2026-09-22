import Link from 'next/link'
import { FEATURES } from '@/lib/features'
import { LED } from '@/lib/venue'

/** Home: pick a tool. Each page also carries the site menu, so this is the front door, not the only way in. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-primary text-[11px] font-bold tracking-[0.18em] uppercase">Haveli</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">The stage, in the browser.</h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-[14px] leading-relaxed">
        Two tools on one model of the Haveli stage: the {LED.w} × {LED.h} m back LED at {LED.px[0]} × {LED.px[1]}, the cabin and chair, the
        forestage, and the four-section hall.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {FEATURES.map(({ href, label, blurb, Icon }) => (
          <Link key={href} href={href} className="card-glass hover:border-primary/60 group rounded-2xl p-5 transition-colors">
            <Icon className="text-primary size-5" />
            <div className="mt-3 text-[16px] font-semibold">
              {label} <span className="text-muted-foreground inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </div>
            <p className="text-muted-foreground mt-1 text-[12.5px] leading-relaxed">{blurb}</p>
          </Link>
        ))}
      </div>
      <p className="text-muted-foreground mt-8 text-[11.5px]">Every page has this menu in its corner.</p>
    </main>
  )
}
