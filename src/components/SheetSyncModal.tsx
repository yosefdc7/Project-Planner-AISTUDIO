import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  PlusCircle,
  Smartphone,
  Globe,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { Project, SyncStatus } from '../types';
import { User } from 'firebase/auth';

interface SheetSyncModalProps {
  isOpen: boolean;
  project: Project;
  user: User | null;
  syncStatus: SyncStatus;
  isAutoSync: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onCreateSheet: () => void;
  onLinkSheet: (sheetIdOrUrl: string) => void;
  onPushToSheet: () => void;
  onPullFromSheet: () => void;
  onToggleAutoSync: (enabled: boolean) => void;
}

export const SheetSyncModal: React.FC<SheetSyncModalProps> = ({
  isOpen,
  project,
  user,
  syncStatus,
  isAutoSync,
  onClose,
  onSignIn,
  onSignOut,
  onCreateSheet,
  onLinkSheet,
  onPushToSheet,
  onPullFromSheet,
  onToggleAutoSync,
}) => {
  const [sheetInput, setSheetInput] = useState('');
  const [activeTab, setActiveTab] = useState<'sync' | 'architecture'>('sync');

  if (!isOpen) return null;

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetInput.trim()) return;
    onLinkSheet(sheetInput.trim());
    setSheetInput('');
  };

  return (
    <div
      id="sheet-sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="sheet-sync-modal-card"
        className="w-full max-w-2xl rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Google Sheets Backend & Sync Hub
              </h3>
              <p className="text-xs text-slate-500">
                Full two-way synchronization for Project: <span className="font-semibold text-slate-700">{project.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'sync'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Synchronization Controls
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" /> Multi-Platform & Schema
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto py-4 space-y-4 pr-1">
          {activeTab === 'sync' ? (
            <>
              {/* Google Account Status Banner */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="User"
                        className="w-full h-full rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      {user ? user.displayName || user.email : 'Google Account Not Connected'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {user
                        ? 'Google Sheets & Drive APIs authorized for this project'
                        : 'Connect Google account to create and sync real Google Sheets'}
                    </div>
                  </div>
                </div>

                {user ? (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    id="btn-google-signin-modal"
                    type="button"
                    onClick={onSignIn}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    Sign in with Google
                  </button>
                )}
              </div>

              {/* Linked Sheet Status */}
              <div className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Backend Spreadsheet
                  </span>
                  {project.spreadsheetId && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </span>
                  )}
                </div>

                {project.spreadsheetId ? (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white border border-emerald-200 rounded-lg text-xs">
                      <div>
                        <div className="font-semibold text-slate-800">
                          {project.spreadsheetName || `Project Plan - ${project.name}`}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate max-w-xs sm:max-w-md">
                          ID: {project.spreadsheetId}
                        </div>
                      </div>
                      {project.spreadsheetUrl && (
                        <a
                          id="link-open-sheet-modal"
                          href={project.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-md font-medium text-xs flex items-center gap-1 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" /> Open in Google Sheets
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span>
                        Last synced:{' '}
                        <strong className="text-slate-700">
                          {project.lastSyncedAt
                            ? new Date(project.lastSyncedAt).toLocaleString()
                            : 'Never'}
                        </strong>
                      </span>
                      <span className="text-[11px]">
                        Status: <strong className="capitalize">{syncStatus.state}</strong>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      No Google Sheet linked yet. You can create a new dedicated spreadsheet in your Google Drive or link an existing Google Sheet.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        id="btn-create-sheet"
                        type="button"
                        onClick={onCreateSheet}
                        disabled={!user || syncStatus.state === 'syncing'}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Create New Google Sheet for this Project
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Link Existing Sheet Input */}
              <form onSubmit={handleLinkSubmit} className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Link Existing Google Sheet (ID or URL)
                </label>
                <div className="flex gap-2">
                  <input
                    id="input-link-sheet"
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/... or Sheet ID"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    id="btn-submit-link-sheet"
                    type="submit"
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shrink-0"
                  >
                    Link Sheet
                  </button>
                </div>
              </form>

              {/* Sync Actions Bar */}
              {project.spreadsheetId && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Two-Way Sync Operations
                    </span>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        id="checkbox-auto-sync"
                        type="checkbox"
                        checked={isAutoSync}
                        onChange={(e) => onToggleAutoSync(e.target.checked)}
                        className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Auto-sync on changes</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      id="btn-push-sheet"
                      type="button"
                      onClick={onPushToSheet}
                      disabled={!user || syncStatus.state === 'syncing'}
                      className="px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                    >
                      <UploadCloud className="w-4 h-4 text-emerald-600" />
                      Push to Sheet (Upload Plan)
                    </button>
                    <button
                      id="btn-pull-sheet"
                      type="button"
                      onClick={onPullFromSheet}
                      disabled={!user || syncStatus.state === 'syncing'}
                      className="px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                    >
                      <DownloadCloud className="w-4 h-4 text-blue-600" />
                      Pull from Sheet (Download Plan)
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Multi-Platform & Schema Architecture Info */
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <div className="flex items-center gap-2 text-indigo-900 font-bold mb-1">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Full Cross-Device Synchronization
                </div>
                <p>
                  Any updates made on desktop web (Gantt timeline drag, WBS indenting, baseline comparison) or mobile (quick task updates, Kanban card movement) synchronize directly through the Google Sheets backend.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wider text-[11px]">
                  Google Sheet Architecture Tabs
                </h4>
                <div className="space-y-2">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                    <span className="font-mono font-bold text-emerald-700">Tasks</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Stores WBS codes, hierarchical levels, task names, start & finish dates, duration, progress %, baseline snapshots, and all custom column values.
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                    <span className="font-mono font-bold text-emerald-700">ProjectInfo</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Project metadata, manager, project start date, status, baseline timestamp, and last synchronization time.
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                    <span className="font-mono font-bold text-emerald-700">CustomColumns</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Definitions for user-added columns (Text, Currency, Number, Date, Dropdowns, Checkboxes).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
