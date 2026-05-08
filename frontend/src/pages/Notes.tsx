import { useState, useEffect, useRef } from 'react'
import { Plus, X, ExternalLink, Search, ChevronDown, Sparkles, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { marked } from 'marked'

const BASE = window.location.hostname === 'localhost' ? 'http://localhost:4111' : ''

const CATEGORIES = ['all', 'article', 'note'] as const
type CategoryFilter = typeof CATEGORIES[number]

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  article: 'Articles',
  note: 'Notes',
}

interface Note {
  id: string
  category: string
  title: string | null
  url: string | null
  content: string | null
  created_at: string
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={cn(
      'text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border',
      category === 'article' && 'border-blue-500/30 text-blue-400',
      category === 'note' && 'border-border text-muted-foreground',
    )}>
      {category}
    </span>
  )
}

function NoteRow({ note }: { note: Note }) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = !!note.content
  const title = note.title || note.url || note.content?.slice(0, 60) + '...' || 'Untitled'

  return (
    <div className="border-b border-border/50 hover:bg-muted/20 transition-colors">
      <button
        onClick={() => hasContent && setExpanded(v => !v)}
        className={cn('w-full text-left px-4 py-3 flex items-start gap-3', !hasContent && 'cursor-default')}
      >
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{title}</span>
            <CategoryBadge category={note.category} />
          </div>
          <span className="text-xs text-muted-foreground">{fmtDate(note.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {note.url && (
            <a
              href={note.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink size={13} />
            </a>
          )}
          {hasContent && (
            <ChevronDown size={13} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          )}
        </div>
      </button>
      {expanded && note.content && (
        <div className="px-4 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
        </div>
      )}
    </div>
  )
}

const STREAM_URL = BASE + '/api/agents/jobsearch/stream'

function AskPanel({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const ask = async () => {
    const q = input.trim()
    if (!q || loading) return
    setLoading(true)
    setAnswer('')
    try {
      const res = await fetch(STREAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: `Search my notes: ${q}` }] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      let text = ''
      let buffer = ''
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          const trimmed = line.slice(6).trim()
          if (!trimmed || trimmed === '[DONE]') continue
          try {
            const chunk = JSON.parse(trimmed)
            if (chunk.type === 'text-delta' && chunk.payload?.text) {
              text += chunk.payload.text
              setAnswer(text)
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setAnswer(e instanceof Error ? `Error: ${e.message}` : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-border bg-muted/10 px-4 py-3 flex flex-col gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ask about your notes…"
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
        />
        <button
          onClick={ask}
          disabled={loading || !input.trim()}
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <Send size={13} />
        </button>
        <button onClick={onClose} className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
          <X size={13} />
        </button>
      </div>
      {(loading || answer) && (
        <div className={cn(
          'text-sm leading-relaxed rounded-lg border border-border bg-card px-3 py-2.5',
          loading && !answer && 'text-muted-foreground animate-pulse'
        )}>
          {loading && !answer ? 'Searching…' : (
            <div
              className="prose prose-sm prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: marked.parse(answer) as string }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showAsk, setShowAsk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [fCategory, setFCategory] = useState('article')
  const [fTitle, setFTitle] = useState('')
  const [fUrl, setFUrl] = useState('')
  const [fContent, setFContent] = useState('')

  useEffect(() => {
    fetch(BASE + '/data/notes')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setNotes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = notes.filter(n => {
    const matchCat = filter === 'all' || n.category === filter
    const q = query.toLowerCase()
    const matchQ = !q ||
      (n.title ?? '').toLowerCase().includes(q) ||
      (n.content ?? '').toLowerCase().includes(q) ||
      (n.url ?? '').toLowerCase().includes(q)
    return matchCat && matchQ
  })

  const resetForm = () => {
    setFTitle('')
    setFUrl('')
    setFContent('')
    setFCategory('article')
    setSaveError(null)
  }

  const save = async () => {
    if (!fTitle.trim() && !fUrl.trim() && !fContent.trim()) {
      setSaveError('Add a title, URL, or some content.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const r = await fetch(BASE + '/data/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: fCategory,
          title: fTitle.trim() || null,
          url: fUrl.trim() || null,
          content: fContent.trim() || null,
        }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const newNote: Note = await r.json()
      setNotes(prev => [newNote, ...prev])
      setShowAdd(false)
      resetForm()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 px-4 py-3 border-b border-border flex items-center gap-3">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
          placeholder="Search notes..."
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => { setShowAsk(v => !v); if (!showAsk) setShowAdd(false) }}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium border rounded-md px-2.5 py-1.5 transition-colors',
              showAsk
                ? 'border-foreground text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            )}
          >
            <Sparkles size={12} /> Ask
          </button>
          <button
            onClick={() => { setShowAdd(v => !v); if (showAdd) resetForm(); if (!showAdd) setShowAsk(false) }}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md px-2.5 py-1.5 hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            {showAdd ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Add</>}
          </button>
        </div>
      </div>

      {/* Ask panel */}
      {showAsk && <AskPanel onClose={() => setShowAsk(false)} />}

      {/* Add form */}
      {showAdd && (
        <div className="border-b border-border bg-muted/10 px-4 py-4 flex flex-col gap-3 shrink-0">
          <div className="flex gap-2">
            {(['article', 'note'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFCategory(cat)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border transition-colors',
                  fCategory === cat
                    ? 'border-foreground text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <input
            value={fTitle}
            onChange={e => setFTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring/30"
          />

          <input
            value={fUrl}
            onChange={e => setFUrl(e.target.value)}
            placeholder="URL (optional)"
            type="url"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring/30"
          />

          <textarea
            value={fContent}
            onChange={e => setFContent(e.target.value)}
            placeholder="Paste content, notes, or description..."
            rows={4}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring/30 resize-none"
          />

          {saveError && <p className="text-xs text-destructive">{saveError}</p>}

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-foreground text-background rounded-md hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-1 px-4 py-2 border-b border-border shrink-0">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md transition-colors',
              filter === cat
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground font-mono self-center">
          {filtered.length}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="px-4 py-6 text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="px-4 py-6 text-sm text-destructive">Error: {error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {notes.length === 0
                ? 'No notes yet. Hit Add to save an article, link, or note.'
                : 'No matches.'}
            </p>
          </div>
        )}
        {filtered.map(note => <NoteRow key={note.id} note={note} />)}
      </div>
    </div>
  )
}
