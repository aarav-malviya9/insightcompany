import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, BarChart3, BookOpen, Check, ChevronRight, CircleHelp, Clock3, FileSearch, Globe2, Link2, LoaderCircle, LockKeyhole, Newspaper, Search, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { blink } from '@/blink/client'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

/**
 * Home route (/). A neutral, FULL-BLEED starting point — no app chrome, no
 * sidebar. Replace this body with your real landing page or app home.
 *
 * Add more pages as files under `src/routes/` (e.g. `src/routes/about.tsx`
 * → /about). The HTML document + providers live once in `__root.tsx`.
 *
 * Building a SaaS / dashboard app? The sidebar shell already exists at
 * `src/routes/app.tsx` with its home at `src/routes/app/index.tsx` (→ /app) — add
 * your pages as files in `src/routes/app/`. Do NOT create a `src/routes/_app.tsx`:
 * a `_`-prefixed layout is PATHLESS, so `_app/index.tsx` resolves to `/` and
 * collides with THIS file (build fails: "Conflicting configuration paths").
 * Dashboard-only product? Keep this file and redirect it to `/app`.
 * Landing pages, marketing sites, content, and games stay full-bleed (default) —
 * delete `src/routes/app.tsx` + `src/routes/app/` if you don't need a dashboard.
 *
 * SEO: set per-page title/description/Open Graph here in `head()`.
 *
 * SSR / routing (this template is server-rendered — TanStack Start):
 * - Routes are files under `src/routes/` that `export const Route =
 *   createFileRoute('/path')({ component })`. NEVER `export default` a route.
 *   Navigate with `Link` from `@tanstack/react-router` (there is no `NavLink`).
 * - Reading Blink auth/SDK state (`blink.auth`), `localStorage`, or `window` at
 *   render CRASHES SSR / hydration-mismatches and ships a blank first page. Wrap
 *   that subtree in `<BlinkClientBoundary fallback={…}>` (from
 *   `@/components/BlinkClientBoundary`) — wrap the whole tree if the entire page
 *   needs the browser. Keep static content outside the boundary. Do NOT use the
 *   route's `ssr: false`: a client-only route in this template hits Start's
 *   server-context `node:async_hooks` path (a throwing browser stub) and ships a
 *   BLANK preview ("AsyncLocalStorage is not a constructor").
 */
type ReportSource = { title: string; url: string; snippet?: string; category: string }
type SearchHit = { title: string; link: string; snippet?: string }
type ResearchReport = { text: string; sources: ReportSource[]; company: string; generatedAt: string }
type AppUser = { id: string; email?: string; displayName?: string }

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'InsightCompany — Company intelligence, clearly sourced' },
      { name: 'description', content: 'Research public companies with a sourced briefing on earnings, material changes, news, and business relationships.' },
    ],
  }),
  component: Home,
})

function Home() {
  return (
    <BlinkClientBoundary fallback={<div className="min-h-dvh animate-pulse bg-background" aria-label="Loading company research workspace" />}>
      <ResearchWorkspace />
    </BlinkClientBoundary>
  )
}

function ReportText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-7 text-foreground/90">
      {text.split('\n').filter((line) => line.trim()).map((line, index) => {
        const clean = line.trim()
        if (clean.startsWith('### ')) return <h3 key={index} className="pt-4 font-semibold text-foreground">{clean.slice(4)}</h3>
        if (clean.startsWith('## ')) return <h2 key={index} className="pt-6 font-serif text-xl text-foreground">{clean.slice(3)}</h2>
        if (clean.startsWith('# ')) return <h2 key={index} className="pt-6 font-serif text-2xl text-foreground">{clean.slice(2)}</h2>
        if (/^[-*•]\s/.test(clean)) return <div key={index} className="flex gap-3 pl-1"><span className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" /><p>{clean.replace(/^[-*•]\s/, '')}</p></div>
        return <p key={index}>{clean}</p>
      })}
    </div>
  )
}

function ResearchWorkspace() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [company, setCompany] = useState(() => new URLSearchParams(window.location.search).get('company') ?? '')
  const [report, setReport] = useState<ResearchReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      if (!state.isLoading) setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  const signInForResearch = (name: string) => {
    const returnUrl = new URL(window.location.href)
    returnUrl.searchParams.set('company', name.trim())
    blink.auth.login(returnUrl.toString())
  }

  const runResearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = company.trim()
    if (!name) return
    if (!user) {
      signInForResearch(name)
      return
    }

    setBusy(true)
    setReport(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const currentYear = new Date().getFullYear()
      setPhase('Finding earnings and filings')
      const [earnings, news, relationships] = await Promise.all([
        blink.data.search(`"${name}" investor relations earnings quarterly results annual report SEC filings`, { limit: 6 }),
        blink.data.search(`"${name}" company latest news strategic changes acquisitions leadership ${currentYear}`, { limit: 6 }),
        blink.data.search(`"${name}" subsidiaries partnerships suppliers joint ventures business relationships`, { limit: 6 }),
      ])
      const groups: { category: string; hits: SearchHit[] }[] = [
        { category: 'Earnings & filings', hits: earnings.organic_results },
        { category: 'News & changes', hits: news.organic_results },
        { category: 'Business relationships', hits: relationships.organic_results },
      ]
      const seen = new Set<string>()
      const sources = groups.flatMap(({ category, hits }) => hits.map((hit) => ({
        title: hit.title,
        url: hit.link,
        snippet: hit.snippet,
        category,
      }))).filter((source) => {
        if (!source.url || seen.has(source.url)) return false
        seen.add(source.url)
        return true
      }).slice(0, 15)

      setPhase('Building a sourced company briefing')
      const evidence = sources.map((source, index) => `[${index + 1}] ${source.category} — ${source.title}\nURL: ${source.url}\nSearch excerpt: ${source.snippet || 'No excerpt provided.'}`).join('\n\n')
      const { text } = await blink.ai.generateText({
        prompt: `You are an equity research analyst preparing a careful public-company intelligence briefing. Research the company named exactly: "${name}". Current date: ${today}.\n\nUse ONLY the supplied search evidence below. Do not invent facts, figures, dates, relationships, filings, or conclusions. If evidence is thin or conflicting, say so and identify what needs confirmation. Never imply this is an exhaustive archive. For every factual claim, include one or more citations matching the numbered evidence, such as [1] or [2][4]. Do not create links or citations outside this list. Distinguish reported facts from interpretation, and label any interpretation. Preserve currencies, fiscal periods, and units exactly as found.\n\nWrite a detailed, readable markdown briefing with these exact sections:\n## Executive snapshot\n## Earnings and filings\n## Material company changes\n## Recent news\n## Business connections\n## What remains unverified\n\nIn Earnings and filings, identify the newest reported quarter/year and any available revenue, earnings, guidance, or filing dates; summarize trends only when multiple periods are supported. Name relevant annual/quarterly reports or transcripts found. In Business connections, name only evidenced subsidiaries, joint ventures, partnerships, major customers/suppliers, parent companies, or strategic ties; label the relationship and its evidence. Give absolute dates when possible. If a section has no reliable evidence, say so plainly. Finish with a concise note that this is web-indexed research and not investment advice.\n\nSEARCH EVIDENCE:\n${evidence || 'No search results were returned.'}`,
        maxTokens: 2400,
      })
      setReport({ text, sources, company: name, generatedAt: new Date().toLocaleString() })
      setPhase('')
      toast.success(`Research briefing ready for ${name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Company research could not be completed. Please try again.'
      setPhase('')
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="InsightCompany home">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BarChart3 size={19} strokeWidth={2.4} /></span>
            <span className="font-semibold tracking-tight">insight<span className="text-primary">company</span></span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary" />Research desk</span>
            {authLoading ? <span className="size-9 animate-pulse rounded-full bg-muted" /> : user ? (
              <Button variant="outline" className="rounded-full" onClick={() => blink.auth.logout()}>Sign out</Button>
            ) : (
              <Button variant="ghost" className="rounded-full" onClick={() => signInForResearch(company || 'company')}>Sign in</Button>
            )}
          </div>
        </div>
      </header>

      <div id="top" className="mx-auto max-w-7xl px-5 pb-20 pt-12 md:px-8 md:pt-20">
        <section className="grid gap-10 lg:grid-cols-[1.03fr_0.97fr] lg:items-center">
          <div className="animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
              <Sparkles size={14} /> Company intelligence, with receipts
            </div>
            <h1 className="max-w-2xl font-serif text-5xl leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">Know what’s moving <span className="italic text-primary">a company.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">Bring earnings, business changes, current news, and company relationships into one clear, source-linked briefing.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-primary" /> Claims linked to sources</span>
              <span className="inline-flex items-center gap-2"><Globe2 size={16} /> Web-indexed research</span>
            </div>
          </div>

          <div className="relative rounded-[1.75rem] border border-border bg-card p-5 shadow-lg sm:p-7">
            <div className="absolute -right-3 -top-3 hidden size-16 rounded-2xl border border-primary/20 bg-accent/70 sm:block" aria-hidden="true" />
            <div className="relative">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Company research</div>
                  <h2 className="mt-2 font-serif text-2xl">Start with a name</h2>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary"><FileSearch size={21} /></span>
              </div>
              <p className="mb-5 text-sm leading-6 text-muted-foreground">Search a public company to create a detailed briefing from live web results.</p>
              <form onSubmit={(event) => void runResearch(event)}>
                <label htmlFor="company-name" className="mb-2 block text-sm font-medium">Company name</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input id="company-name" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g. Adobe, Toyota, Shopify" className="h-12 rounded-xl border-input bg-background pl-11 text-base" aria-describedby="research-note" />
                  </div>
                  <Button type="submit" disabled={busy || !company.trim()} className="h-12 rounded-xl px-5 transition-transform hover:scale-[1.02] active:scale-[0.98]">
                    {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Search size={17} />}
                    {user ? 'Research company' : 'Get started'}
                    {!busy && <ArrowRight size={16} />}
                  </Button>
                </div>
              </form>
              <p id="research-note" className="mt-3 text-xs leading-5 text-muted-foreground">{user ? 'Search results are summarized with links to the underlying sources.' : 'Sign in is required to run a research search. Your company name is carried through sign-in.'}</p>
              <div className="mt-6 border-t border-border pt-5">
                <div className="mb-3 text-xs font-medium text-muted-foreground">Try a company</div>
                <div className="flex flex-wrap gap-2">
                  {['NVIDIA', 'Novo Nordisk', 'Toyota'].map((name) => <button key={name} onClick={() => setCompany(name)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5">{name}</button>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-4 border-y border-border/80 py-7 sm:grid-cols-3" aria-label="Research coverage">
          <Coverage icon={<TrendingUp size={18} />} label="Earnings & filings" detail="Quarterly results, annual reports, and guidance" />
          <Coverage icon={<Newspaper size={18} />} label="News & change" detail="Leadership, acquisitions, strategy, and developments" />
          <Coverage icon={<Link2 size={18} />} label="Company connections" detail="Partnerships, subsidiaries, suppliers, and more" />
        </section>

        {busy && <section className="mt-10 rounded-3xl border border-border bg-card p-6 sm:p-9" aria-live="polite"><div className="flex items-center gap-3"><LoaderCircle size={19} className="animate-spin text-primary" /><div><h2 className="font-medium">Researching {company}</h2><p className="mt-1 text-sm text-muted-foreground">{phase}. This can take a little while.</p></div></div><div className="mt-7 space-y-3"><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /><div className="h-3 w-full animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /></div></section>}

        {report && !busy && <ReportPanel report={report} onClear={() => setReport(null)} />}

        {!report && !busy && <section className="mt-12 grid gap-8 rounded-3xl bg-secondary/55 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-9">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary"><BookOpen size={15} /> Built for a quick read, not a quick guess</div><h2 className="mt-3 font-serif text-2xl sm:text-3xl">A better starting point for company research.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">See what the search surfaced, what it could not verify, and where each detail came from—before drawing your own conclusions.</p></div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm"><CircleHelp size={18} className="text-primary" /><span className="max-w-52 text-muted-foreground">Web search coverage is useful, but not an exhaustive filings archive.</span></div>
        </section>}

        <footer className="mt-12 flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>InsightCompany · Independent research workspace</span>
          <span className="inline-flex items-center gap-1.5"><LockKeyhole size={13} /> Source-led, not investment advice</span>
        </footer>
      </div>
    </main>
  )
}

function Coverage({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return <div className="flex gap-3 px-1"><span className="mt-0.5 text-primary">{icon}</span><div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div>
}

function ReportPanel({ report, onClear }: { report: ResearchReport; onClear: () => void }) {
  return (
    <section className="mt-12 overflow-hidden rounded-3xl border border-border bg-card shadow-md" aria-live="polite">
      <div className="flex flex-col justify-between gap-5 border-b border-border bg-secondary/45 px-5 py-6 sm:flex-row sm:items-center sm:px-8">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><Check size={15} /> Research briefing</div><h2 className="mt-2 font-serif text-3xl">{report.company}</h2><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 size={13} /> Prepared {report.generatedAt}</p></div>
        <Button variant="outline" onClick={onClear} className="w-fit rounded-full">New search <ArrowRight size={15} /></Button>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 px-5 py-7 sm:px-8 sm:py-9"><ReportText text={report.text} /></div>
        <aside className="border-t border-border bg-secondary/25 px-5 py-6 sm:px-8 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Sources</h3><span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">{report.sources.length}</span></div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Search results used to prepare this briefing. Open the original page to verify details.</p>
          <div className="mt-4 space-y-2">
            {report.sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="group block rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40">
              <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-primary">{source.category}</span><ChevronRight size={13} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
              <span className="line-clamp-2 text-xs font-medium leading-5">[{index + 1}] {source.title}</span>
              {source.snippet && <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">{source.snippet}</span>}
            </a>)}
            {report.sources.length === 0 && <p className="rounded-xl border border-border p-3 text-xs leading-5 text-muted-foreground">No source links were returned for this search. Treat the briefing as incomplete.</p>}
          </div>
        </aside>
      </div>
      <div className="flex items-start gap-2 border-t border-border px-5 py-4 text-xs leading-5 text-muted-foreground sm:px-8"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" /><p>Web-indexed coverage can omit filings or recent updates. Confirm important details in official investor-relations materials and regulatory filings. This briefing is informational, not investment advice.</p></div>
    </section>
  )
}
