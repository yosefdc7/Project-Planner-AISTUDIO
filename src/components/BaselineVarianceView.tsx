import React, { useState, useMemo } from 'react';
import {
  TaskItem,
  Project,
  ProjectBaselineVersion,
  TaskStatus,
} from '../types';
import {
  compareAgainstBaseline,
  DetailedVarianceItem,
  ResourceDelta,
} from '../utils/wbs';
import {
  Bookmark,
  BookmarkCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  Plus,
  Layers,
  Search,
  Filter,
  ArrowRight,
  Download,
  RotateCcw,
  Sparkles,
  GitCommit,
  Milestone,
  Check,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

interface BaselineVarianceViewProps {
  project: Project;
  tasks: TaskItem[];
  baselineVersions?: ProjectBaselineVersion[];
  activeVersionNumber?: number;
  onOpenSaveBaseline: () => void;
  onOpenManageBaselines: () => void;
  onSetActiveBaseline: (versionNumber: number) => void;
  onClearBaseline: () => void;
  onEditTask: (task: TaskItem) => void;
  onRevertToBaseline?: (version: ProjectBaselineVersion) => void;
}

export const BaselineVarianceView: React.FC<BaselineVarianceViewProps> = ({
  project,
  tasks,
  baselineVersions = [],
  activeVersionNumber,
  onOpenSaveBaseline,
  onOpenManageBaselines,
  onSetActiveBaseline,
  onClearBaseline,
  onEditTask,
  onRevertToBaseline,
}) => {
  // Selected baseline version to compare against
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(() => {
    if (activeVersionNumber && baselineVersions.some((v) => v.versionNumber === activeVersionNumber)) {
      return activeVersionNumber;
    }
    return baselineVersions[0]?.versionNumber || 1;
  });

  const [activeTab, setActiveTab] = useState<
    'all' | 'slippage' | 'scope' | 'resources' | 'versions_log'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected baseline version object
  const selectedBaselineVersion = useMemo(() => {
    return (
      baselineVersions.find((v) => v.versionNumber === selectedVersionNum) ||
      baselineVersions[0] ||
      null
    );
  }, [baselineVersions, selectedVersionNum]);

  // Run comprehensive comparison against selected baseline
  const comparisonResult = useMemo(() => {
    if (!selectedBaselineVersion) return null;
    return compareAgainstBaseline(tasks, selectedBaselineVersion);
  }, [tasks, selectedBaselineVersion]);

  // Filtered items based on active tab and search
  const filteredItems = useMemo(() => {
    if (!comparisonResult) return [];
    let list = comparisonResult.items;

    // Apply tab filter
    if (activeTab === 'slippage') {
      list = list.filter(
        (item) => (item.finishVariance && item.finishVariance > 0) || (item.startVariance && item.startVariance > 0)
      );
    } else if (activeTab === 'scope') {
      list = list.filter((item) => item.scopeStatus === 'added' || item.scopeStatus === 'removed');
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.wbs.includes(q) ||
          item.currentAssignee.toLowerCase().includes(q) ||
          (item.baselineAssignee && item.baselineAssignee.toLowerCase().includes(q))
      );
    }

    return list;
  }, [comparisonResult, activeTab, searchQuery]);

  // Export variance report to CSV
  const handleExportCSV = () => {
    if (!comparisonResult || !selectedBaselineVersion) return;

    const headers = [
      'WBS',
      'Task Name',
      'Scope Status',
      'Baseline Start',
      'Current Start',
      'Start Variance (Days)',
      'Baseline Finish',
      'Current Finish',
      'Finish Slippage (Days)',
      'Baseline Duration',
      'Current Duration',
      'Duration Variance (Days)',
      'Baseline Assignee',
      'Current Assignee',
      'Resource Reassigned',
      'Status',
      '% Complete',
    ];

    const rows = comparisonResult.items.map((item) => [
      item.wbs,
      `"${item.name.replace(/"/g, '""')}"`,
      item.scopeStatus.toUpperCase(),
      item.baselineStart || '',
      item.currentStart || '',
      item.startVariance !== null ? item.startVariance : '',
      item.baselineFinish || '',
      item.currentFinish || '',
      item.finishVariance !== null ? item.finishVariance : '',
      item.baselineDuration !== null ? item.baselineDuration : '',
      item.currentDuration !== null ? item.currentDuration : '',
      item.durationVariance !== null ? item.durationVariance : '',
      `"${item.baselineAssignee || ''}"`,
      `"${item.currentAssignee || ''}"`,
      item.resourceChanged ? 'YES' : 'NO',
      item.currentStatus || '',
      item.currentProgress !== null ? `${item.currentProgress}%` : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${project.name.replace(/\s+/g, '_')}_Baseline_v${selectedBaselineVersion.versionNumber}_Variance_Report.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = comparisonResult?.stats;

  return (
    <div
      id="view-baseline-variance"
      className="flex-1 h-full overflow-auto bg-slate-50 p-4 sm:p-6 space-y-6"
    >
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Header Card */}
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <Bookmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">
                  Baseline Variance & Scope Analysis
                </h1>
                {selectedBaselineVersion ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                    <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
                    Comparing vs Version {selectedBaselineVersion.versionNumber}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                    No Baseline Recorded
                  </span>
                )}
                {selectedBaselineVersion &&
                  activeVersionNumber === selectedBaselineVersion.versionNumber && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active on Gantt
                    </span>
                  )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {selectedBaselineVersion
                  ? `"${selectedBaselineVersion.name}" saved on ${new Date(selectedBaselineVersion.createdAt).toLocaleDateString()} at ${new Date(selectedBaselineVersion.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by ${selectedBaselineVersion.createdBy || 'Project Manager'}`
                  : 'Capture a baseline to benchmark schedule slippage, finish delays, resource allocation changes, and scope additions.'}
              </p>
            </div>
          </div>

          {/* Controls: Version Selector & Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-start lg:justify-end">
            {baselineVersions.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                <label
                  htmlFor="select-variance-version"
                  className="text-xs font-semibold text-slate-600 pl-1"
                >
                  Baseline:
                </label>
                <select
                  id="select-variance-version"
                  value={selectedBaselineVersion?.versionNumber || 1}
                  onChange={(e) => setSelectedVersionNum(parseInt(e.target.value))}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  {baselineVersions.map((v) => (
                    <option key={v.id} value={v.versionNumber}>
                      v{v.versionNumber}: {v.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedBaselineVersion &&
              activeVersionNumber !== selectedBaselineVersion.versionNumber && (
                <button
                  type="button"
                  onClick={() => onSetActiveBaseline(selectedBaselineVersion.versionNumber)}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1"
                  title="Make this version the active overlay on Gantt Chart and WBS Grid"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" /> Make Active
                </button>
              )}

            <button
              id="btn-variance-save-new"
              type="button"
              onClick={onOpenSaveBaseline}
              className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              title="Save a new baseline version (up to 100 versions)"
            >
              <Plus className="w-4 h-4" /> Save Baseline
            </button>

            <button
              id="btn-variance-manage"
              type="button"
              onClick={onOpenManageBaselines}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1"
              title="Manage all saved baseline versions"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Versions ({baselineVersions.length}/100)</span>
            </button>

            {comparisonResult && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1"
                title="Download CSV Variance Report"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">CSV Report</span>
              </button>
            )}
          </div>
        </div>

        {/* If no baseline recorded */}
        {!selectedBaselineVersion ? (
          <div className="p-10 rounded-xl bg-white border border-slate-200 text-center space-y-3">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              <Bookmark className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-slate-800">No Baseline Snapshot Created</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              A baseline preserves the approved schedule (start, finish, duration) and resource allocation for all project tasks. Save a snapshot now to monitor slippage and scope creep.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenSaveBaseline}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Capture Baseline Version 1
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Executive Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* On Schedule */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  On Schedule
                </span>
                <div className="mt-1 text-2xl font-black text-emerald-600">
                  {stats?.onTrackCount || 0}
                </div>
                <span className="text-[10px] text-slate-500">Tasks tracking to plan</span>
              </div>

              {/* Delayed / Slippage */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Slippage / Delay
                </span>
                <div className="mt-1 text-2xl font-black text-rose-600">
                  {stats?.delayedCount || 0}
                </div>
                <span className="text-[10px] text-slate-500">
                  {stats?.milestonesDelayed ? `${stats.milestonesDelayed} milestone(s) late` : 'Tasks finishing late'}
                </span>
              </div>

              {/* Ahead of Schedule */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Ahead of Plan
                </span>
                <div className="mt-1 text-2xl font-black text-blue-600">
                  {stats?.aheadCount || 0}
                </div>
                <span className="text-[10px] text-slate-500">Tasks completing early</span>
              </div>

              {/* Scope Added */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Scope Added
                </span>
                <div className="mt-1 text-2xl font-black text-purple-600">
                  +{stats?.scopeAddedCount || 0}
                </div>
                <span className="text-[10px] text-slate-500">New tasks not in baseline</span>
              </div>

              {/* Scope Removed */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Descoped
                </span>
                <div className="mt-1 text-2xl font-black text-amber-600">
                  -{stats?.scopeRemovedCount || 0}
                </div>
                <span className="text-[10px] text-slate-500">Tasks removed from plan</span>
              </div>

              {/* Duration Growth */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Duration Growth
                </span>
                <div className="mt-1 text-2xl font-black text-slate-800">
                  {(stats?.durationVariance || 0) > 0
                    ? `+${stats?.durationVariance}d`
                    : `${stats?.durationVariance || 0}d`}
                </div>
                <span className="text-[10px] text-slate-500">
                  Base: {stats?.baselineTotalDuration}d &bull; Now: {stats?.currentTotalDuration}d
                </span>
              </div>
            </div>

            {/* Sub-view Filter Navigation & Search */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeTab === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Tasks ({comparisonResult?.items.length || 0})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('slippage')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'slippage'
                        ? 'bg-white text-rose-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Slippage & Delays ({stats?.delayedCount || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('scope')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'scope'
                        ? 'bg-white text-purple-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-500" />
                    <span>
                      Scope Changes ({(stats?.scopeAddedCount || 0) + (stats?.scopeRemovedCount || 0)})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('resources')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'resources'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Resource Allocation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('versions_log')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'versions_log'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GitCommit className="w-3.5 h-3.5 text-slate-500" />
                    <span>Versions History ({baselineVersions.length})</span>
                  </button>
                </div>

                {/* Search in table */}
                {activeTab !== 'resources' && activeTab !== 'versions_log' && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search tasks, WBS, assignee..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg bg-white w-48 sm:w-60 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* View 1 & 2 & 3: Variance Breakdown Table */}
              {(activeTab === 'all' || activeTab === 'slippage' || activeTab === 'scope') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-14">WBS</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Task Name</th>
                        <th className="py-2.5 px-3 w-32">Scope Status</th>
                        <th className="py-2.5 px-3 w-40">Resource Allocation</th>
                        <th className="py-2.5 px-2.5 w-24">Base Start</th>
                        <th className="py-2.5 px-2.5 w-24">Current Start</th>
                        <th className="py-2.5 px-2 w-20">Start Var</th>
                        <th className="py-2.5 px-2.5 w-24">Base Finish</th>
                        <th className="py-2.5 px-2.5 w-24">Current Finish</th>
                        <th className="py-2.5 px-2 w-24">Finish Slippage</th>
                        <th className="py-2.5 px-2 w-20">Dur Var</th>
                        <th className="py-2.5 px-3 w-28">Variance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-8 text-center text-slate-400 text-xs">
                            No tasks matching the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => {
                          const isDelayed = (item.finishVariance || 0) > 0;
                          const isAhead = (item.finishVariance || 0) < 0;
                          const isScopeAdded = item.scopeStatus === 'added';
                          const isScopeRemoved = item.scopeStatus === 'removed';

                          // Row color accents
                          let rowBg = 'hover:bg-slate-50/70';
                          if (isScopeAdded) rowBg = 'bg-purple-50/20 hover:bg-purple-50/40';
                          if (isScopeRemoved) rowBg = 'bg-amber-50/20 hover:bg-amber-50/40 opacity-70';

                          return (
                            <tr
                              key={item.id}
                              onDoubleClick={() => {
                                const currentTask = tasks.find((t) => t.id === item.id);
                                if (currentTask) onEditTask(currentTask);
                              }}
                              className={`transition-colors cursor-pointer ${rowBg}`}
                              title="Double click to edit task"
                            >
                              {/* WBS */}
                              <td className="py-2 px-3 font-mono font-bold text-slate-700">
                                {item.wbs}
                              </td>

                              {/* Task Name */}
                              <td className="py-2 px-3">
                                <div
                                  className="flex items-center gap-1.5"
                                  style={{ paddingLeft: `${item.level * 14}px` }}
                                >
                                  {item.isMilestone && (
                                    <Milestone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                  <span
                                    className={`truncate max-w-xs font-medium ${
                                      isScopeRemoved
                                        ? 'line-through text-slate-400'
                                        : item.isSummary
                                        ? 'font-bold text-slate-900'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                              </td>

                              {/* Scope Status */}
                              <td className="py-2 px-3">
                                {isScopeAdded ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1 w-max">
                                    <Plus className="w-3 h-3" /> New / Scope Added
                                  </span>
                                ) : isScopeRemoved ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 w-max">
                                    Descoped / Removed
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 w-max">
                                    Baseline Scope
                                  </span>
                                )}
                              </td>

                              {/* Resource Allocation */}
                              <td className="py-2 px-3">
                                <div className="flex flex-col text-[11px]">
                                  {item.resourceChanged ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-sm line-through">
                                        {item.baselineAssignee || 'None'}
                                      </span>
                                      <ArrowRight className="w-3 h-3 text-indigo-500 shrink-0" />
                                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-sm">
                                        {item.currentAssignee}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-700 font-medium truncate">
                                      {item.currentAssignee}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Base Start */}
                              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400">
                                {item.baselineStart || '-'}
                              </td>

                              {/* Current Start */}
                              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700">
                                {item.currentStart || '-'}
                              </td>

                              {/* Start Variance */}
                              <td className="py-2 px-2 font-mono text-[11px]">
                                {item.startVariance !== null ? (
                                  <span
                                    className={
                                      item.startVariance > 0
                                        ? 'text-rose-600 font-bold'
                                        : item.startVariance < 0
                                        ? 'text-blue-600 font-semibold'
                                        : 'text-slate-400'
                                    }
                                  >
                                    {item.startVariance > 0
                                      ? `+${item.startVariance}d`
                                      : `${item.startVariance}d`}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>

                              {/* Base Finish */}
                              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400">
                                {item.baselineFinish || '-'}
                              </td>

                              {/* Current Finish */}
                              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700">
                                {item.currentFinish || '-'}
                              </td>

                              {/* Finish Slippage */}
                              <td className="py-2 px-2 font-mono text-[11px] font-bold">
                                {item.finishVariance !== null ? (
                                  <span
                                    className={
                                      isDelayed
                                        ? 'text-rose-600'
                                        : isAhead
                                        ? 'text-emerald-600'
                                        : 'text-slate-400'
                                    }
                                  >
                                    {item.finishVariance > 0
                                      ? `+${item.finishVariance}d delay`
                                      : item.finishVariance < 0
                                      ? `${item.finishVariance}d ahead`
                                      : '0d'}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>

                              {/* Duration Variance */}
                              <td className="py-2 px-2 font-mono text-[11px]">
                                {item.durationVariance !== null ? (
                                  <span
                                    className={
                                      item.durationVariance > 0
                                        ? 'text-rose-600 font-bold'
                                        : item.durationVariance < 0
                                        ? 'text-emerald-600'
                                        : 'text-slate-400'
                                    }
                                  >
                                    {item.durationVariance > 0
                                      ? `+${item.durationVariance}d`
                                      : `${item.durationVariance}d`}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="py-2 px-3">
                                {isScopeAdded ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                    New Scope
                                  </span>
                                ) : isScopeRemoved ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Removed
                                  </span>
                                ) : isDelayed ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1 w-max">
                                    <AlertTriangle className="w-3 h-3" /> Slipped Late
                                  </span>
                                ) : isAhead ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 flex items-center gap-1 w-max">
                                    <Check className="w-3 h-3" /> Ahead
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max">
                                    <CheckCircle2 className="w-3 h-3" /> On Track
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View 4: Resource Allocation Workload Comparison */}
              {activeTab === 'resources' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Resource Workload & Allocation Shift
                      </h3>
                      <p className="text-xs text-slate-500">
                        Compares total task assignments and planned effort (days) per team member in Baseline vs Current project
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 min-w-[180px]">Team Member / Assignee</th>
                          <th className="py-2.5 px-3 w-28">Base Tasks</th>
                          <th className="py-2.5 px-3 w-28">Current Tasks</th>
                          <th className="py-2.5 px-3 w-28">Task Delta</th>
                          <th className="py-2.5 px-3 w-32">Base Effort</th>
                          <th className="py-2.5 px-3 w-32">Current Effort</th>
                          <th className="py-2.5 px-3 w-32">Workload Delta</th>
                          <th className="py-2.5 px-3 w-32">Allocation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparisonResult?.resourceComparison.map((res) => {
                          const isOver = res.deltaDays > 0;
                          const isUnder = res.deltaDays < 0;

                          return (
                            <tr key={res.resourceName} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                                  {res.resourceName.charAt(0)}
                                </div>
                                <span>{res.resourceName}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {res.baselineTasks} tasks
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-mono font-semibold">
                                {res.currentTasks} tasks
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <span
                                  className={
                                    res.deltaTasks > 0
                                      ? 'text-purple-600 font-bold'
                                      : res.deltaTasks < 0
                                      ? 'text-amber-600 font-semibold'
                                      : 'text-slate-400'
                                  }
                                >
                                  {res.deltaTasks > 0 ? `+${res.deltaTasks}` : res.deltaTasks}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {res.baselineDays} days
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-mono font-semibold">
                                {res.currentDays} days
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <span
                                  className={
                                    isOver
                                      ? 'text-rose-600 font-bold'
                                      : isUnder
                                      ? 'text-blue-600 font-semibold'
                                      : 'text-slate-400'
                                  }
                                >
                                  {res.deltaDays > 0 ? `+${res.deltaDays}d` : `${res.deltaDays}d`}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {isOver ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                    Increased Load (+{res.deltaDays}d)
                                  </span>
                                ) : isUnder ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                    Reduced Load ({res.deltaDays}d)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                    Aligned to Baseline
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* View 5: Baseline Versions Log */}
              {activeTab === 'versions_log' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        All Baseline Versions (1 to 100)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Audit trail of all preserved schedule and resource snapshots for this project
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenSaveBaseline}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Save Next Version
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-20">Version</th>
                          <th className="py-2.5 px-3 min-w-[200px]">Baseline Name</th>
                          <th className="py-2.5 px-3 w-44">Date Saved</th>
                          <th className="py-2.5 px-3 w-28">Tasks</th>
                          <th className="py-2.5 px-3 w-28">Duration</th>
                          <th className="py-2.5 px-3 w-32">Active Status</th>
                          <th className="py-2.5 px-3 w-40 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {baselineVersions.map((v) => {
                          const isActive = v.versionNumber === activeVersionNumber;
                          const isCurrentlySelected = v.versionNumber === selectedBaselineVersion.versionNumber;

                          return (
                            <tr
                              key={v.id}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                isCurrentlySelected ? 'bg-indigo-50/30' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                                v{v.versionNumber}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{v.name}</div>
                                {v.description && (
                                  <div className="text-[11px] text-slate-500 italic mt-0.5">
                                    {v.description}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {v.summary.totalTasks} tasks
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono">
                                {v.summary.totalDuration} days
                              </td>
                              <td className="py-2.5 px-3">
                                {isActive ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max">
                                    <CheckCircle2 className="w-3 h-3" /> Active on Gantt
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 w-max">
                                    Historical
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedVersionNum(v.versionNumber);
                                      setActiveTab('all');
                                    }}
                                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                                  >
                                    View Diff
                                  </button>
                                  {!isActive && (
                                    <button
                                      type="button"
                                      onClick={() => onSetActiveBaseline(v.versionNumber)}
                                      className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                                    >
                                      Make Active
                                    </button>
                                  )}
                                  {onRevertToBaseline && (
                                    <button
                                      type="button"
                                      onClick={() => onRevertToBaseline(v)}
                                      className="px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-md transition-colors"
                                      title="Restore project schedule & resources to this baseline"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
