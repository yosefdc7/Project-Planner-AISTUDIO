import React from 'react';
import {
  Table,
  GitFork,
  Kanban,
  Bookmark,
  Plus,
  ArrowRight,
  ArrowLeft,
  ZoomIn,
  Search,
  SlidersHorizontal,
  BookmarkCheck,
  Columns,
  Clock,
  RefreshCw,
  Milestone,
  Flame,
  Workflow,
} from 'lucide-react';
import { ViewMode, TimelineZoom } from '../types';

interface ToolbarProps {
  viewMode: ViewMode;
  timelineZoom: TimelineZoom;
  showBaseline: boolean;
  hasBaseline: boolean;
  showCriticalPath?: boolean;
  criticalCount?: number;
  dependencyCount?: number;
  onOpenDependencyMapping?: () => void;
  baselineVersionsCount?: number;
  activeBaselineVersion?: number;
  selectedTaskId: string | null;
  searchQuery: string;
  onViewChange: (mode: ViewMode) => void;
  onZoomChange: (zoom: TimelineZoom) => void;
  onToggleBaseline: () => void;
  onToggleCriticalPath?: () => void;
  onSetBaseline: () => void;
  onClearBaseline: () => void;
  onOpenManageBaselines?: () => void;
  onAddTask: () => void;
  onAddSubtask: () => void;
  onAddMilestone: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onAddCustomColumn: () => void;
  onSearchChange: (query: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  viewMode,
  timelineZoom,
  showBaseline,
  hasBaseline,
  showCriticalPath = false,
  criticalCount = 0,
  dependencyCount = 0,
  onOpenDependencyMapping,
  baselineVersionsCount = 0,
  activeBaselineVersion,
  selectedTaskId,
  searchQuery,
  onViewChange,
  onZoomChange,
  onToggleBaseline,
  onToggleCriticalPath,
  onSetBaseline,
  onClearBaseline,
  onOpenManageBaselines,
  onAddTask,
  onAddSubtask,
  onAddMilestone,
  onIndent,
  onOutdent,
  onAddCustomColumn,
  onSearchChange,
}) => {
  return (
    <div
      id="app-toolbar"
      className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-20 shadow-xs"
    >
      {/* Left: View Mode Switcher Pills */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          id="btn-view-gantt"
          type="button"
          onClick={() => onViewChange('gantt')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
            viewMode === 'gantt'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="MS Project Classic Gantt Chart & WBS Grid"
        >
          <Table className="w-3.5 h-3.5 text-emerald-600" />
          <span>Gantt & Grid</span>
        </button>

        <button
          id="btn-view-wbs-tree"
          type="button"
          onClick={() => onViewChange('wbs_tree')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
            viewMode === 'wbs_tree'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Work Breakdown Structure Tree Diagram"
        >
          <GitFork className="w-3.5 h-3.5 text-emerald-600" />
          <span>WBS Tree</span>
        </button>

        <button
          id="btn-view-kanban"
          type="button"
          onClick={() => onViewChange('kanban')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
            viewMode === 'kanban'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Agile Status Kanban Board"
        >
          <Kanban className="w-3.5 h-3.5 text-emerald-600" />
          <span>Kanban</span>
        </button>

        <button
          id="btn-view-baseline"
          type="button"
          onClick={() => onViewChange('baseline')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
            viewMode === 'baseline'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Schedule Baseline vs Actual Variance"
        >
          <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
          <span>Baseline Variance</span>
        </button>
      </div>

      {/* Center/Right: Task Editing Actions & Baseline */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Quick Task Creation */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          <button
            id="btn-add-task"
            type="button"
            onClick={onAddTask}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Task
          </button>

          <button
            id="btn-add-subtask"
            type="button"
            onClick={onAddSubtask}
            disabled={!selectedTaskId}
            title={selectedTaskId ? 'Add subtask under selected task' : 'Select a task first to add subtask'}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:hover:bg-slate-100 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Subtask
          </button>

          <button
            id="btn-add-milestone"
            type="button"
            onClick={onAddMilestone}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors"
          >
            <Milestone className="w-3.5 h-3.5 text-amber-600" /> Milestone
          </button>
        </div>

        {/* WBS Indent & Outdent */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          <button
            id="btn-outdent-task"
            type="button"
            onClick={onOutdent}
            disabled={!selectedTaskId}
            title="Outdent Task (Promote Level)"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            id="btn-indent-task"
            type="button"
            onClick={onIndent}
            disabled={!selectedTaskId}
            title="Indent Task (Demote / Make Subtask)"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Baseline Management Tools */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          <button
            id="btn-set-baseline"
            type="button"
            onClick={onSetBaseline}
            className="px-2 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md flex items-center gap-1 transition-colors"
            title="Snapshot current start, finish, duration, and resources as Baseline"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Save Baseline</span>
            <span className="sm:hidden">Baseline</span>
          </button>

          {onOpenManageBaselines && (
            <button
              id="btn-manage-baselines-toolbar"
              type="button"
              onClick={onOpenManageBaselines}
              className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md flex items-center gap-1 transition-colors"
              title="Manage up to 100 baseline versions"
            >
              <Bookmark className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Baselines</span>
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">
                {baselineVersionsCount}/100
              </span>
            </button>
          )}

          {hasBaseline && (
            <button
              id="btn-toggle-baseline-view"
              type="button"
              onClick={onToggleBaseline}
              className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                showBaseline
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
              title="Toggle baseline bars on Gantt chart"
            >
              {showBaseline ? 'Hide Baseline' : 'Show Baseline'}
            </button>
          )}
        </div>

        {/* Critical Path Highlight Toggle */}
        {onToggleCriticalPath && (
          <button
            id="btn-toggle-critical-path"
            type="button"
            onClick={onToggleCriticalPath}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-all shadow-xs ${
              showCriticalPath
                ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
            }`}
            title="Toggle Critical Path highlight: Color-code tasks that impact the overall project completion date"
          >
            <Flame className={`w-3.5 h-3.5 ${showCriticalPath ? 'text-white fill-white' : 'text-rose-500'}`} />
            <span>Critical Path</span>
            {criticalCount > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full transition-colors ${
                  showCriticalPath ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {criticalCount}
              </span>
            )}
          </button>
        )}

        {/* Dependency Mapping Feature Button */}
        {onOpenDependencyMapping && (
          <button
            id="btn-open-dependency-mapping"
            type="button"
            onClick={onOpenDependencyMapping}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 transition-all shadow-xs"
            title="Dependency Mapping: Create Finish-to-Start relationships and auto-shift dependent dates"
          >
            <Workflow className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Dependencies</span>
            <span className="sm:hidden">FS</span>
            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-200/80 text-emerald-900">
              {dependencyCount}
            </span>
          </button>
        )}

        {/* Custom Columns Button */}
        <button
          id="btn-add-custom-col"
          type="button"
          onClick={onAddCustomColumn}
          className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md flex items-center gap-1 transition-colors"
          title="Add custom data column (text, currency, select, checkbox)"
        >
          <Columns className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden md:inline">+ Column</span>
        </button>

        {/* Timeline Zoom (for Gantt) */}
        {viewMode === 'gantt' && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-xs font-medium">
            <button
              type="button"
              onClick={() => onZoomChange('days')}
              className={`px-2 py-1 rounded-xs ${
                timelineZoom === 'days' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500'
              }`}
            >
              Days
            </button>
            <button
              type="button"
              onClick={() => onZoomChange('weeks')}
              className={`px-2 py-1 rounded-xs ${
                timelineZoom === 'weeks' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500'
              }`}
            >
              Weeks
            </button>
            <button
              type="button"
              onClick={() => onZoomChange('months')}
              className={`px-2 py-1 rounded-xs ${
                timelineZoom === 'months' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500'
              }`}
            >
              Months
            </button>
          </div>
        )}

        {/* Search / Filter */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
          <input
            id="input-filter-tasks"
            type="text"
            placeholder="Search tasks or assignee..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-7 pr-3 py-1 text-xs border border-slate-300 rounded-md outline-hidden focus:ring-2 focus:ring-emerald-500 w-36 sm:w-48 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
