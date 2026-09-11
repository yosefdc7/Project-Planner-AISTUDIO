import React from 'react';
import { ViewMode } from '../types';
import { Table, GitFork, Kanban, Bookmark, FileSpreadsheet, Plus } from 'lucide-react';

interface MobileNavProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  onOpenSyncHub: () => void;
  onAddTask: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  viewMode,
  onViewChange,
  onOpenSyncHub,
  onAddTask,
}) => {
  return (
    <div
      id="mobile-bottom-nav"
      className="md:hidden bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shrink-0 z-40 select-none"
    >
      <button
        type="button"
        onClick={() => onViewChange('gantt')}
        className={`flex flex-col items-center py-1 px-2 rounded-md text-[10px] font-semibold transition-colors ${
          viewMode === 'gantt' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Table className="w-4 h-4 mb-0.5" />
        <span>Gantt</span>
      </button>

      <button
        type="button"
        onClick={() => onViewChange('wbs_tree')}
        className={`flex flex-col items-center py-1 px-2 rounded-md text-[10px] font-semibold transition-colors ${
          viewMode === 'wbs_tree' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <GitFork className="w-4 h-4 mb-0.5" />
        <span>WBS</span>
      </button>

      {/* Floating style Add Task action button */}
      <button
        type="button"
        onClick={onAddTask}
        className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg -mt-4 active:scale-95 transition-transform"
        title="Add Task"
      >
        <Plus className="w-6 h-6" />
      </button>

      <button
        type="button"
        onClick={() => onViewChange('kanban')}
        className={`flex flex-col items-center py-1 px-2 rounded-md text-[10px] font-semibold transition-colors ${
          viewMode === 'kanban' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Kanban className="w-4 h-4 mb-0.5" />
        <span>Kanban</span>
      </button>

      <button
        type="button"
        onClick={() => onViewChange('baseline')}
        className={`flex flex-col items-center py-1 px-2 rounded-md text-[10px] font-semibold transition-colors ${
          viewMode === 'baseline' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Bookmark className="w-4 h-4 mb-0.5" />
        <span>Baseline</span>
      </button>

      <button
        type="button"
        onClick={onOpenSyncHub}
        className="flex flex-col items-center py-1 px-2 rounded-md text-[10px] font-semibold text-slate-400 hover:text-slate-200"
      >
        <FileSpreadsheet className="w-4 h-4 mb-0.5 text-emerald-400" />
        <span>Sync</span>
      </button>
    </div>
  );
};
