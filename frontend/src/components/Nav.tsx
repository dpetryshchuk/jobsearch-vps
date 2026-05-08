import { NavLink } from 'react-router-dom'
import { MessageSquare, Users, BarChart2, FileText, Briefcase, Inbox, Pencil, Activity, Database } from 'lucide-react'
import { cn } from '@/lib/utils'

const mainNavItems = [
  { to: '/', label: 'Chat', icon: MessageSquare },
  { to: '/leads', label: 'Leads', icon: Inbox },
  { to: '/pipeline', label: 'Pipeline', icon: Users },
  { to: '/retro', label: 'Retro', icon: BarChart2 },
  { to: '/notes', label: 'Notes', icon: FileText },
]

const utilNavItems = [
  { to: '/applications', label: 'Applications', icon: Briefcase },
  { to: '/content', label: 'Content', icon: Pencil },
  { to: '/usage', label: 'Usage', icon: Activity },
  { to: '/schema', label: 'Schema', icon: Database },
]

const mobileNavItems = [
  { to: '/', label: 'Chat', icon: MessageSquare },
  { to: '/leads', label: 'Leads', icon: Inbox },
  { to: '/pipeline', label: 'Pipeline', icon: Users },
  { to: '/retro', label: 'Retro', icon: BarChart2 },
  { to: '/notes', label: 'Notes', icon: FileText },
]

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-sidebar h-screen fixed left-0 top-0 z-20">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-foreground" />
        <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">Jobby</span>
      </div>

      <nav className="flex flex-col flex-1 px-2 py-3 gap-0.5 overflow-y-auto">
        {mainNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                  : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}

        <div className="mt-auto pt-4 border-t border-border mx-1 flex flex-col gap-0.5">
          {utilNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  )
}

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-background border-t border-border safe-area-inset-bottom">
      <div className="flex">
        {mobileNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium tracking-wide transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
