import React, { useState, useEffect } from 'react';
import { Project, TaskItem, ProjectBaselineVersion } from '../types';
import { Bookmark, BookmarkCheck, AlertCircle, Info, Calendar, Users, X } from 'lucide-react';

interface SaveBaselineModalProps {
  isOpen: boolean;
  project: Project;
  tasks: TaskItem[];
  existingVersions: ProjectBaselineVersion[];
  onClose: () => void;
  onSaveBaseline: (
    versionNumber: number,
    name: string,
    description: string,
    setAsActive: boolean
  ) => void;
}

export const SaveBaselineModal: React.FC<SaveBaselineModalProps> = ({
  isOpen,
  project,
  tasks,
  existingVersions,
  onClose,
  onSaveBaseline,
}) => {
  // Find next available version number between 1 and 100
  const findNextVersion = (): number => {
    const used = new Set(existingVersions.map((v) => v.versionNumber));
    for (let i = 1; i <= 100; i++) {
      if (!used.has(i)) return i;
    }
    return 1;
  };

  const [versionNumber, setVersionNumber] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [setAsActive, setSetAsActive] = useState<boolean>(true);

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      const nextV = findNextVersion();
      setVersionNumber(nextV);
      setName(`Baseline ${nextV}: ${existingVersions.length === 0 ? 'Initial Project Schedule & Resource Plan' : `Revision ${nextV}`}`);
      setDescription('');
      setSetAsActive(true);
    }
  }, [isOpen, existingVersions.length]);

  if (!isOpen) return null;

  const existingVersionMatch = existingVersions.find((v) => v.versionNumber === versionNumber);

  // Calculate quick metrics for preview
  const totalTasks = tasks.length;
  const totalDuration = tasks.filter((t) => !t.isSummary).reduce((sum, t) => sum + t.duration, 0);
  const distinctResources = new Set(tasks.map((t) => t.assignee).filter(Boolean)).size;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (versionNumber < 1 || versionNumber > 100) return;
    onSaveBaseline(versionNumber, name.trim(), description.trim(), setAsActive);
    onClose();
  };

  return (
    <div
      id="modal-save-baseline"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Save Project Baseline Snapshot</h2>
              <p className="text-xs text-slate-500">Benchmark schedule dates, durations, and resource allocation</p>
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Version Selector (1 to 100) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Baseline Version (1 to 100)
            </label>
            <div className="flex items-center gap-2">
              <select
                id="select-baseline-version"
                value={versionNumber}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setVersionNumber(val);
                  if (!name || name.startsWith('Baseline ')) {
                    setName(`Baseline ${val}: ${val === 1 ? 'Initial Project Schedule & Resource Plan' : `Revision ${val}`}`);
                  }
                }}
                className="w-48 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
              >
                {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => {
                  const isOccupied = existingVersions.some((v) => v.versionNumber === num);
                  return (
                    <option key={num} value={num}>
                      Version {num} {isOccupied ? '• (Existing)' : ''}
                    </option>
                  );
                })}
              </select>

              <span className="text-xs text-slate-500">
                Supports up to 100 baseline versions
              </span>
            </div>

            {existingVersionMatch && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Overwrite Warning: </span>
                  Baseline Version {versionNumber} was previously saved on{' '}
                  {new Date(existingVersionMatch.createdAt).toLocaleDateString()}. Saving now will overwrite that snapshot with current project data.
                </div>
              </div>
            )}
          </div>

          {/* Baseline Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Baseline Name / Milestone Tag
            </label>
            <input
              id="input-baseline-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Baseline 1: Approved Schedule & Resource Plan"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>

          {/* Description / Revision Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Change Rationale (Optional)
            </label>
            <textarea
              id="input-baseline-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Formal client sign-off on Sprint 1-4 deliverables and resource allocations."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-900 resize-none"
            />
          </div>

          {/* Snapshot Summary Box */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              Snapshot Scope & Resource Summary
            </div>
            <div className="grid grid-cols-3 gap-2 text-slate-600">
              <div className="p-2 bg-white rounded-md border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Tasks Captured</span>
                <span className="text-sm font-bold text-slate-800">{totalTasks} tasks</span>
              </div>
              <div className="p-2 bg-white rounded-md border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Planned Duration</span>
                <span className="text-sm font-bold text-slate-800">{totalDuration} days</span>
              </div>
              <div className="p-2 bg-white rounded-md border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Resources</span>
                <span className="text-sm font-bold text-slate-800">{distinctResources} assignees</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              All task start dates, due dates, durations, and assignees will be frozen into this version for slippage and scope change comparison.
            </p>
          </div>

          {/* Checkbox: Set as Active Baseline */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="check-set-active-baseline"
              type="checkbox"
              checked={setAsActive}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="h-4 w-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-500"
            />
            <label htmlFor="check-set-active-baseline" className="text-xs text-slate-700 font-medium">
              Set as active baseline for Gantt chart overlay and WBS Grid variance
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-save-baseline"
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <BookmarkCheck className="w-4 h-4" /> Save Baseline Version {versionNumber}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
