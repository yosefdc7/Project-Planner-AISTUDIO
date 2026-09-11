import React, { useState } from 'react';
import { Project, ProjectBaselineVersion } from '../types';
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  Clock,
  Trash2,
  RotateCcw,
  Eye,
  CheckCircle2,
  X,
  Search,
  Plus,
  Users,
  FileSpreadsheet,
} from 'lucide-react';

interface BaselineManagerModalProps {
  isOpen: boolean;
  project: Project;
  baselineVersions: ProjectBaselineVersion[];
  activeVersionNumber?: number;
  onClose: () => void;
  onOpenSaveModal: () => void;
  onSetActiveVersion: (versionNumber: number) => void;
  onDeleteVersion: (versionNumber: number) => void;
  onRevertToVersion: (version: ProjectBaselineVersion) => void;
  onSelectCompareVersion: (versionNumber: number) => void;
}

export const BaselineManagerModal: React.FC<BaselineManagerModalProps> = ({
  isOpen,
  project,
  baselineVersions,
  activeVersionNumber,
  onClose,
  onOpenSaveModal,
  onSetActiveVersion,
  onDeleteVersion,
  onRevertToVersion,
  onSelectCompareVersion,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredVersions = baselineVersions
    .filter(
      (v) =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        String(v.versionNumber).includes(search) ||
        (v.description && v.description.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => a.versionNumber - b.versionNumber);

  return (
    <div
      id="modal-baseline-manager"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Baseline Versions Repository</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                  {baselineVersions.length} of 100 versions saved
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Manage schedule and resource allocation snapshots for {project.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search baseline versions by number, name, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSaveModal();
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> New Baseline
          </button>
        </div>

        {/* List of Versions */}
        <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 space-y-3">
          {filteredVersions.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <Bookmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold">No baseline versions found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Save a snapshot of your project's initial schedule and resource allocation to start tracking variance.
              </p>
            </div>
          ) : (
            filteredVersions.map((v) => {
              const isActive = v.versionNumber === activeVersionNumber;

              return (
                <div
                  key={v.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Left details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-600 text-white font-mono text-xs font-bold rounded-md">
                          v{v.versionNumber}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900">{v.name}</h3>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Active on Gantt & Grid
                          </span>
                        )}
                      </div>

                      {v.description && (
                        <p className="text-xs text-slate-600 italic">{v.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>•</span>
                        <span>{v.summary.totalTasks} tasks snapshot</span>
                        <span>•</span>
                        <span>{v.summary.totalDuration} days total</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          {v.summary.resources.length} resources
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCompareVersion(v.versionNumber);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                        title="Compare current project against this baseline"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" /> Compare
                      </button>

                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => onSetActiveVersion(v.versionNumber)}
                          className="px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1 transition-colors"
                          title="Display this baseline as the overlay on Gantt Chart and WBS Grid"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" /> Make Active
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onRevertToVersion(v)}
                        className="px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1 transition-colors"
                        title="Revert current project schedule & resources to this baseline snapshot"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteVersion(v.versionNumber)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                        title="Delete this baseline version"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Baseline versions capture frozen schedules and resource allocations for audit compliance and variance tracking.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
