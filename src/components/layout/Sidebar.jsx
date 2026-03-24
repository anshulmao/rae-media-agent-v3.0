import React from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  Home,
  LayoutGrid,
  PenLine,
  MessageSquare,
  Database,
  ShieldCheck,
  Settings,
  Bell
} from 'lucide-react'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/creator/select', icon: Home,          label: 'Home',            section: 'main' },
  { to: '/feed',           icon: LayoutGrid,    label: 'Content Feed',    section: 'main' },
  { to: '/creator/qa',     icon: MessageSquare, label: 'Media Q&A',       section: 'main' },
  { to: '/creator/generate', icon: PenLine,     label: 'Content Creator', section: 'main' },
  { to: '/control-panel',  icon: ShieldCheck,   label: 'Admin Panel',     section: 'admin' },
  { to: '/admin',          icon: Database,       label: 'Knowledge Base',  section: 'admin' },
  { to: '/settings',       icon: Settings,       label: 'Settings',        section: 'admin' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <Link to="/creator/select" className="sidebar-logo">
        <div className="logo-mark">
          <span className="logo-c">C</span>
        </div>
      </Link>

      {/* Main nav */}
      <nav className="sidebar-nav">
        <div className="nav-group">
          {NAV_ITEMS.filter(i => i.section === 'main').map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={label}
            >
              <Icon size={20} />
            </NavLink>
          ))}
        </div>

        <div className="nav-divider" />

        <div className="nav-group">
          {NAV_ITEMS.filter(i => i.section === 'admin').map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={label}
            >
              <Icon size={20} />
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="nav-item" title="Notifications" style={{ border: 'none', cursor: 'pointer', width: '100%', position: 'relative' }}>
          <Bell size={20} />
          <span className="notif-dot" />
        </button>
        <div className="sidebar-avatar" title="My Profile">
          <img
            src="https://ui-avatars.com/api/?name=Alex+C&background=0064DC&color=fff&size=64"
            alt="Profile"
          />
        </div>
      </div>
    </aside>
  )
}
