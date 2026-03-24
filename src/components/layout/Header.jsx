import React from 'react'
import { Bell, Search, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Header.css'

export function Header() {
  return (
    <header className="header">
      {/* Left: CelcomDigi + Rae branding */}
      <Link to="/creator/select" className="header-brand">
        <span className="brand-celcom">celcomdigi</span>
        <span className="brand-divider" />
        <span className="brand-rae">rae</span>
      </Link>

      {/* Center: Search */}
      <div className="header-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search Rae's library"
          className="search-input"
        />
      </div>

      {/* Right: Actions */}
      <div className="header-actions">
        <button className="header-icon-btn" title="Profile">
          <User size={18} />
        </button>
        <button className="header-icon-btn notif-btn" title="Notifications">
          <Bell size={18} />
          <span className="header-badge">3</span>
        </button>
        <div className="header-avatar">
          <img
            src="https://ui-avatars.com/api/?name=Alex+C&background=0064DC&color=fff&size=64"
            alt="Profile"
          />
        </div>
      </div>
    </header>
  )
}
