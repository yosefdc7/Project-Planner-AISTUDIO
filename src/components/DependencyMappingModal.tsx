import React, { useState, useMemo } from 'react';
import {
  X,
  Link2,
  ArrowRight,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Workflow,
  Search,
  Calendar,
  Sparkles,
  Flame,
  Info,
} from 'lucide-react';
import { TaskItem, DependencyLinkItem } from '../types';
import {
  wouldCreateCycle,
  getAllDependencyLinks,
  addDays,
  diffDays,
} from '../utils/wbs';

interface DependencyMappingModalProps {
  isOpen: boolean;
  tasks: TaskItem[];
  criticalTaskIds: Set<string>;
  onClose: () => void;
  onAddDependency: (predecessorId: string, successorId: string) => { success: boolean; error?: string; shiftedCount: number };
  onRemoveDependency: (predecessorId: string, successorId: string) => void;
  onAutoScheduleAll: () => { shiftedCount: number };
}

export const DependencyMappingModal: React.FC<DependencyMappingModalProps> = ({
  isOpen,
  tasks,
  criticalTaskIds,
  onClose,
  onAddDependency,
  onRemoveDependency,
  onAutoScheduleAll,
}) => {
  const [selectedPredId, setSelectedPredId] = useState<string>('');
  const [selectedSuccId, setSelectedSuccId] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Active links in the current project
  const dependencyLinks = useMemo(() => {
    return getAllDependencyLinks(tasks, criticalTaskIds);
  }, [tasks, criticalTaskIds]);

  // Filtered links for table
  const filteredLinks = useMemo(() => {
    if (!searchFilter.trim()) return dependencyLinks;
    const q = searchFilter.toLowerCase();
    return dependencyLinks.filter(
      (l) =>
        l.predecessorName.toLowerCase().includes(q) ||
        l.successorName.toLowerCase().includes(q) ||
        l.predecessorWbs.includes(q) ||
        l.successorWbs.includes(q)
    );
  }, [dependencyLinks, searchFilter]);

  // Candidate task selection lists (excluding summary tasks from being cycle-vulnerable where preferred, though allowed)
  const availableTasks = useMemo(() => {
    return tasks.map((t) => ({
      id: t.id,
      wbs: t.wbs,
      name: t.name,
      startDate: t.startDate,
      dueDate: t.dueDate,
      duration: t.duration,
      isMilestone: t.isMilestone,
      isSummary: t.isSummary,
    }));
  }, [tasks]);

  const selectedPredTask = useMemo(
    () => tasks.find((t) => t.id === selectedPredId),
    [tasks, selectedPredId]
  );
  const selectedSuccTask = useMemo(
    () => tasks.find((t) => t.id === selectedSuccId),
    [tasks, selectedSuccId]
  );

  // Cycle check for current selection
  const cycleDetected = useMemo(() => {
    if (!selectedPredId || !selectedSuccId) return false;
    return wouldCreateCycle(tasks, selectedPredId, selectedSuccId);
  }, [tasks, selectedPredId, selectedSuccId]);

  // Already linked check
  const alreadyLinked = useMemo(() => {
    if (!selectedSuccTask || !selectedPredId) return false;
    return selectedSuccTask.dependencies?.includes(selectedPredId) || false;
  }, [selectedSuccTask, selectedPredId]);

  // Schedule impact preview
  const impactPreview = useMemo(() => {
    if (!selectedPredTask || !selectedSuccTask || cycleDetected || alreadyLinked) return null;

    const earliestStart = addDays(selectedPredTask.dueDate, 1);
    const willShift = selectedSuccTask.startDate < earliestStart;
    const shiftDays = willShift ? diffDays(selectedSuccTask.startDate, earliestStart) : 0;
    const newDueDate = selectedSuccTask.isMilestone
      ? earliestStart
      : addDays(earliestStart, Math.max(1, selectedSuccTask.duration) - 1);

    return {
      earliestStart,
      willShift,
      shiftDays,
      newDueDate,
    };
  }, [selectedPredTask, selectedSuccTask, cycleDetected, alreadyLinked]);

  if (!isOpen) return null;

  const handleCreateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPredId || !selectedSuccId) return;

    if (cycleDetected) {
      setStatusMessage({
        text: 'Cannot create relationship: This introduces a circular dependency.',
        type: 'error',
      });
      return;
    }

    const res = onAddDependency(selectedPredId, selectedSuccId);
    if (res.success) {
      const predName = selectedPredTask?.name || 'Predecessor';
      const succName = selectedSuccTask?.name || 'Successor';
      const shiftNotice = res.shiftedCount > 0
        ? ` (${res.shiftedCount} dependent task${res.shiftedCount > 1 ? 's' : ''} auto-shifted)`
        : '';
      setStatusMessage({
        text: `Linked "${predName}" ➔ "${succName}" via Finish-to-Start${shiftNotice}.`,
        type: 'success',
      });
      setSelectedPredId('');
      setSelectedSuccId('');
    } else {
      setStatusMessage({
        text: res.error || 'Failed to create dependency.',
        type: 'error',
      });
    }
  };

  const handleAutoSchedule = () => {
    const res = onAutoScheduleAll();
    setStatusMessage({
      text: res.shiftedCount > 0
        ? `Auto-scheduled: ${res.shiftedCount} task(s) adjusted to strict Finish-to-Start alignment.`
        : 'All tasks already strictly aligned to Finish-to-Start predecessor dates.',
      type: 'info',
    });
  };

  return (
    <div
      id="dependency-mapping-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="dependency-mapping-modal-card"
        className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Dependency Mapping</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Finish-to-Start (FS)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
                  {dependencyLinks.length} Active Link{dependencyLinks.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Map sequential task dependencies. When a predecessor shifts or expands, dependent task dates automatically adjust.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="btn-close-dependency-mapping"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              {statusMessage.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Create Finish-to-Start Relationship */}
          <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-600" />
                Create New Finish-to-Start Relationship
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Rule: Successor starts after Predecessor finishes
              </span>
            </div>

            <form onSubmit={handleCreateLink} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-center">
                {/* Predecessor Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Predecessor Task (Must Finish First)
                  </label>
                  <select
                    id="select-dep-predecessor"
                    value={selectedPredId}
                    onChange={(e) => setSelectedPredId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                  >
                    <option value="">-- Choose Predecessor Task --</option>
                    {availableTasks.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.id === selectedSuccId}>
                        {t.wbs} {t.name} (Finishes: {t.dueDate})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Relationship Direction Badge */}
                <div className="flex flex-col items-center justify-center pt-5">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-xs font-bold shadow-2xs">
                    <span>FS</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 font-medium">Finish-to-Start</span>
                </div>

                {/* Successor Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Successor Task (Starts After Finish)
                  </label>
                  <select
                    id="select-dep-successor"
                    value={selectedSuccId}
                    onChange={(e) => setSelectedSuccId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                  >
                    <option value="">-- Choose Successor Task --</option>
                    {availableTasks.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.id === selectedPredId}>
                        {t.wbs} {t.name} (Starts: {t.startDate})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Validation & Impact Preview Card */}
              {cycleDetected && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Circular Dependency Detected:</strong> A task cannot depend on a predecessor that already depends on it. Please pick a different relationship.
                  </span>
                </div>
              )}

              {alreadyLinked && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-xs text-amber-800">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>These two tasks are already linked with a Finish-to-Start dependency.</span>
                </div>
              )}

              {impactPreview && !cycleDetected && !alreadyLinked && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Automatic Date Shift Impact Preview
                    </span>
                    {impactPreview.willShift ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                        Will Shift +{impactPreview.shiftDays}d
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800 font-bold text-[11px]">
                        No Shift Needed
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-500">Predecessor Finishes:</span>{' '}
                      <strong className="text-slate-900">{selectedPredTask?.dueDate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Successor New Start:</span>{' '}
                      <strong className="text-emerald-700">{impactPreview.earliestStart}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Successor Current Start:</span>{' '}
                      <span className={impactPreview.willShift ? 'line-through text-slate-400' : 'text-slate-800'}>
                        {selectedSuccTask?.startDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Successor New Due:</span>{' '}
                      <strong className="text-emerald-700">{impactPreview.newDueDate}</strong>
                    </div>
                  </div>
                  {impactPreview.willShift && (
                    <p className="text-[11px] text-emerald-800 font-medium">
                      Linking will automatically move &ldquo;{selectedSuccTask?.name}&rdquo; forward so it starts after &ldquo;{selectedPredTask?.name}&rdquo; finishes.
                    </p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  id="btn-create-dependency-link"
                  disabled={!selectedPredId || !selectedSuccId || cycleDetected || alreadyLinked}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  Establish Finish-to-Start Dependency
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Active Dependencies Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                Active Project Dependencies ({dependencyLinks.length})
              </h4>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search dependencies..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 outline-none w-48 sm:w-60"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoSchedule}
                  id="btn-auto-schedule-dependencies"
                  title="Align all dependent tasks to start immediately following their driving predecessor"
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Auto-Schedule (Tight FS)</span>
                </button>
              </div>
            </div>

            {filteredLinks.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                <Workflow className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-700">No dependencies match your query</p>
                <p className="text-xs text-slate-400 mt-1">
                  Use the builder above to connect tasks with Finish-to-Start relationships.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-100/80 sticky top-0 z-10 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Predecessor</th>
                        <th className="py-2.5 px-2 text-center">Type</th>
                        <th className="py-2.5 px-3">Successor</th>
                        <th className="py-2.5 px-2 text-center">Slack / Lag</th>
                        <th className="py-2.5 px-2 text-center">Critical Path</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredLinks.map((link) => (
                        <tr key={link.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Predecessor */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-600 text-[11px] bg-slate-100 px-1 py-0.5 rounded-xs">
                                {link.predecessorWbs}
                              </span>
                              <span className="font-medium text-slate-800 truncate max-w-[180px]" title={link.predecessorName}>
                                {link.predecessorName}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>Finishes: {link.predecessorDueDate}</span>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-2 px-2 text-center">
                            <span className="px-2 py-0.5 rounded-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                              FS
                            </span>
                          </td>

                          {/* Successor */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-600 text-[11px] bg-slate-100 px-1 py-0.5 rounded-xs">
                                {link.successorWbs}
                              </span>
                              <span className="font-medium text-slate-800 truncate max-w-[180px]" title={link.successorName}>
                                {link.successorName}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>Starts: {link.successorStartDate}</span>
                            </div>
                          </td>

                          {/* Lag */}
                          <td className="py-2 px-2 text-center">
                            {link.lagDays === 0 ? (
                              <span className="px-1.5 py-0.5 rounded-xs bg-slate-100 text-slate-700 font-medium text-[10.5px]">
                                0d (tight)
                              </span>
                            ) : link.lagDays > 0 ? (
                              <span className="px-1.5 py-0.5 rounded-xs bg-blue-50 text-blue-700 border border-blue-100 font-medium text-[10.5px]">
                                +{link.lagDays}d gap
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-xs bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10.5px]">
                                {link.lagDays}d overlap
                              </span>
                            )}
                          </td>

                          {/* Critical Path */}
                          <td className="py-2 px-2 text-center">
                            {link.isDriving ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold">
                                <Flame className="w-2.5 h-2.5 fill-rose-500 text-rose-600" />
                                Driving
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">Standard</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onRemoveDependency(link.predecessorId, link.successorId);
                                setStatusMessage({
                                  text: `Removed dependency link between "${link.predecessorName}" and "${link.successorName}".`,
                                  type: 'info',
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Delete this Finish-to-Start dependency"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Editing task dates in the WBS Grid or Gantt Chart will automatically ripple downstream to dependent tasks.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
