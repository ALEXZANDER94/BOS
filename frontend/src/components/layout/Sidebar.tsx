import { NavLink } from 'react-router-dom'
import { Building2, BookOpen, FileSearch, Settings2, Users, FolderKanban, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavItem =
  | { kind: 'link'; to: string; label: string; icon: React.ElementType }
  | { kind: 'section'; label: string }

const navItems: NavItem[] = [
  { kind: 'link',    to: '/suppliers',   label: 'Suppliers',        icon: Building2  },
  { kind: 'link',    to: '/glossary',    label: 'Unit Glossary',    icon: BookOpen   },
  { kind: 'link',    to: '/comparison',  label: 'Price Comparison', icon: FileSearch },

  { kind: 'section', label: 'CRM' },
  { kind: 'link',    to: '/clients',     label: 'Clients',          icon: Users         },
  { kind: 'link',    to: '/projects',    label: 'Projects',         icon: FolderKanban  },
  { kind: 'link',    to: '/emails',      label: 'Emails',           icon: Mail          },

  { kind: 'section', label: 'System' },
  { kind: 'link',    to: '/settings',    label: 'Settings',         icon: Settings2 },
]

// ── BOS Hexagon logo mark ─────────────────────────────────────────────────────
// A flat-top hexagon with a blue-to-teal gradient, matching the brand image.

function BosLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bos-grad" x1="0" y1="0" x2="40" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#2563EB" /> {/* blue-600  */}
          <stop offset="100%" stopColor="#0D9488" /> {/* teal-600  */}
        </linearGradient>
      </defs>
      {/* Flat-top hexagon */}
      <polygon
        points="20,2 38,12 38,34 20,44 2,34 2,12"
        fill="url(#bos-grad)"
      />
      {/* "B" letterform cut out in white */}
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="22"
      >
        B
      </text>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  return (
    <aside className="flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand area */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <BosLogoMark className="h-9 w-8 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight text-sidebar-foreground leading-tight">
            BOS
          </h1>
          <p className="text-[10px] text-sidebar-foreground/50 leading-tight truncate">
            Business Operations Suite
          </p>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item, index) => {
          if (item.kind === 'section') {
            return (
              <p
                key={`section-${index}`}
                className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none"
              >
                {item.label}
              </p>
            )
          }

          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Tagline footer */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <p className="text-[9px] text-sidebar-foreground/30 tracking-widest uppercase select-none text-center">
          Streamline · Oversight · Performance
        </p>
      </div>
    </aside>
  )
}
