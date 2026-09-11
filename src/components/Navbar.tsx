import React, { useState } from 'react';
import {
  FolderKanban,
  ChevronDown,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  ExternalLink,
  Settings,
  User as UserIcon,
  LogOut,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Cloud,
} from 'lucide-react';
import { Project, SyncStatus } from '../types';
import { User } from 'firebase/auth';

interface NavbarProps {
  currentProject: Project;
  projects: Project[];
  user: User | null;
  syncStatus: SyncStatus;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onEditProject: () => void;
  onOpenSyncHub: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProject,
  projects,
  user,
  syncStatus,
  onSelectProject,
  onNewProject,
  onEditProject,
  onOpenSyncHub,
  onSignIn,
  onSignOut,
}) => {
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  return (
    <header
      id="app-navbar"
      className="bg-slate-900 text-white border-b border-slate-800 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 select-none shrink-0 z-30"
    >
      {/* Left: App Logo & Project Switcher */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-xs">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div className="hidden md:block">
            <span className="font-extrabold tracking-tight text-sm text-white">
              Project<span className="text-emerald-400">Planner</span>
            </span>
            <span className="ml-1.5 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400">
              MS Project Edition
            </span>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-700 hidden sm:block" />

        {/* Project Selector Dropdown */}
        <div className="relative">
          <button
            id="btn-project-dropdown"
            type="button"
            onClick={() => {
              setIsProjectDropdownOpen(!isProjectDropdownOpen);
              setIsUserDropdownOpen(false);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs sm:text-sm font-semibold text-slate-100 max-w-[180px] sm:max-w-xs transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{currentProject.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {isProjectDropdownOpen && (
            <div
              id="dropdown-project-list"
              className="absolute left-0 mt-1.5 w-72 rounded-xl bg-white text-slate-900 shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Project ({projects.length})
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProject(p.id);
                      setIsProjectDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      p.id === currentProject.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div>{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Mgr: {p.manager || 'Unassigned'} &bull; Start: {p.startDate}
                      </div>
                    </div>
                    {p.id === currentProject.id && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 mt-1 pt-1 px-1.5 space-y-0.5">
                <button
                  id="btn-nav-new-project"
                  type="button"
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    onNewProject();
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-emerald-700 font-semibold hover:bg-emerald-50 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Create New Project
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    onEditProject();
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Project Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Sync Status Pill, Google Sheet Link, & Auth */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Google Sheet Sync Status Pill */}
        <button
          id="btn-sync-status-pill"
          type="button"
          onClick={onOpenSyncHub}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            syncStatus.state === 'synced'
              ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300 hover:bg-emerald-900/60'
              : syncStatus.state === 'syncing'
              ? 'bg-blue-950/60 border-blue-500 text-blue-300 animate-pulse'
              : syncStatus.state === 'error'
              ? 'bg-rose-950/60 border-rose-500 text-rose-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
          title="Google Sheets Synchronization Status"
        >
          {syncStatus.state === 'syncing' ? (
            <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
          ) : currentProject.spreadsheetId ? (
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-slate-400" />
          )}

          <span className="hidden sm:inline">
            {syncStatus.state === 'syncing'
              ? 'Syncing Sheets...'
              : currentProject.spreadsheetId
              ? 'Sheets Synced'
              : 'Local (Connect Sheet)'}
          </span>
          <span className="sm:hidden">
            {syncStatus.state === 'syncing' ? 'Syncing' : currentProject.spreadsheetId ? 'Synced' : 'Local'}
          </span>
        </button>

        {/* Direct Open in Google Sheet link */}
        {currentProject.spreadsheetUrl && (
          <a
            id="link-open-google-sheet"
            href={currentProject.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-600/50 text-emerald-200 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Open Sheet <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Google User Profile / Sign In */}
        <div className="relative">
          {user ? (
            <button
              id="btn-user-avatar"
              type="button"
              onClick={() => {
                setIsUserDropdownOpen(!isUserDropdownOpen);
                setIsProjectDropdownOpen(false);
              }}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-emerald-500 transition-all"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full object-cover border border-slate-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </button>
          ) : (
            <button
              id="btn-google-signin"
              type="button"
              onClick={onSignIn}
              className="px-2.5 sm:px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign in with Google</span>
              <span className="sm:hidden">Sign In</span>
            </button>
          )}

          {isUserDropdownOpen && user && (
            <div
              id="dropdown-user-menu"
              className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white text-slate-900 shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="font-bold text-xs text-slate-900 truncate">
                  {user.displayName || 'Google User'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserDropdownOpen(false);
                    onOpenSyncHub();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Google Sheets Backend Hub
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserDropdownOpen(false);
                    onSignOut();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-md flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
