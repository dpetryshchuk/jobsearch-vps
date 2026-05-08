import { useState, useEffect } from 'react'

const BASE = window.location.hostname === 'localhost' ? 'http://localhost:4111' : ''

interface RetroData {
  stats: {
    sent_week: string
    received_week: string
    active: string
    total_contacts: string
  }
  bySource: { source: string; stage: string; n: string }[]
  needsAction: { name: string; company: string | null; stage: string; last_contact: string | null }[]
  alltime: {
    sent_total: string
    received_total: string
    contacts_total: string
    dead_total: string
    first_interaction: string | null
  }
  weekly: { week: string; direction: string; n: string }[]
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function relativeDate(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Retro() {
  const [data, setData] = useState<RetroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(BASE + '/data/retro')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  if (error) return <div className="p-6 text-sm text-destructive">Error: {error}</div>
  if (!data) return null

  const sentWeek = parseInt(data.stats.sent_week) || 0
  const rcvdWeek = parseInt(data.stats.received_week) || 0
  const replyRate = sentWeek > 0 ? Math.round(rcvdWeek / sentWeek * 100) : 0
  const sentTotal = parseInt(data.alltime.sent_total) || 0
  const rcvdTotal = parseInt(data.alltime.received_total) || 0
  const rateTotal = sentTotal > 0 ? Math.round(rcvdTotal / sentTotal * 100) : 0

  const sourceMap: Record<string, Record<string, number>> = {}
  data.bySource.forEach(r => {
    if (!sourceMap[r.source]) sourceMap[r.source] = {}
    sourceMap[r.source][r.stage] = parseInt(r.n)
  })

  const weekMap: Record<string, { sent: number; received: number }> = {}
  data.weekly.forEach(r => {
    if (!weekMap[r.week]) weekMap[r.week] = { sent: 0, received: 0 }
    if (r.direction === 'out') weekMap[r.week].sent = parseInt(r.n)
    if (r.direction === 'in') weekMap[r.week].received = parseInt(r.n)
  })
  const weeks = Object.entries(weekMap).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="overflow-y-auto flex flex-col gap-8 px-6 py-6">
      {/* This week */}
      <section>
        <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-border">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">This week</h2>
          <span className="text-xs text-muted-foreground">
            {'Week of ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Sent out" value={sentWeek} sub="this week" />
          <StatCard label="Replies in" value={rcvdWeek} sub="this week" />
          <StatCard label="Reply rate" value={`${replyRate}%`} sub={sentWeek > 0 ? `${rcvdWeek} / ${sentWeek}` : 'no data'} />
          <StatCard label="Active" value={data.stats.active} sub={`of ${data.stats.total_contacts} contacts`} />
        </div>

        {Object.keys(sourceMap).length > 0 && (
          <>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">
              Funnel by source
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {Object.entries(sourceMap).map(([source, stages]) => {
                const outreached = stages['Outreached'] || 0
                const responded = stages['Responded'] || 0
                const ongoing = stages['Ongoing'] || 0
                const max = outreached || 1
                return (
                  <div key={source} className="border border-border rounded-lg p-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">{source}</p>
                    {[['Outreached', outreached, 100], ['Responded', responded, Math.round(responded / max * 100)], ['Ongoing', ongoing, Math.round(ongoing / max * 100)]].map(
                      ([label, count, pct]) => (
                        <div key={label as string}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <div className="h-px bg-border mb-2 relative">
                            <div className="absolute inset-y-0 left-0 bg-foreground/30" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">
          Needs action
        </p>
        {data.needsAction.length === 0 ? (
          <p className="text-sm text-muted-foreground">All caught up.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {data.needsAction.map((c, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/30 text-sm">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.stage === 'Ongoing' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
                <span className="font-medium flex-1">{c.name}</span>
                <span className="text-muted-foreground text-xs">{c.company ?? '—'}</span>
                <span className="text-muted-foreground text-xs">
                  {c.last_contact ? `Last: ${relativeDate(c.last_contact)}` : 'No contact'} — follow up
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All time */}
      <section>
        <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-border">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">All time</h2>
          {data.alltime.first_interaction && (
            <span className="text-xs text-muted-foreground">Since {fmtDate(data.alltime.first_interaction)}</span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Sent total" value={sentTotal} sub="all time" />
          <StatCard label="Replies total" value={rcvdTotal} sub="all time" />
          <StatCard label="Reply rate" value={`${rateTotal}%`} sub={sentTotal > 0 ? `${rcvdTotal} / ${sentTotal}` : 'no data'} />
          <StatCard label="Contacts" value={data.alltime.contacts_total} sub={`${data.alltime.dead_total} dead`} />
        </div>

        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">
          Week by week
        </p>
        {weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Week of', 'Sent', 'Received', 'Rate'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map(([week, { sent, received }]) => {
                  const rate = sent > 0 ? `${Math.round(received / sent * 100)}%` : '—'
                  return (
                    <tr key={week} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3">{fmtDate(week)}</td>
                      <td className="py-2.5 px-3">{sent}</td>
                      <td className="py-2.5 px-3">{received}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{rate}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
