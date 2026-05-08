import { Search, Plus } from 'lucide-react'

export default function Notes() {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background z-10 px-4 py-3 border-b border-border flex items-center gap-3">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
          placeholder="Search notes..."
        />
        <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md px-2.5 py-1.5 hover:text-foreground hover:border-foreground/30 transition-colors">
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Notes not yet wired — coming soon.</p>
      </div>
    </div>
  )
}
