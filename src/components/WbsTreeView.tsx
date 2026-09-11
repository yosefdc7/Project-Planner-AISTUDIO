import React, { useState } from 'react';
import { TaskItem, Project } from '../types';
import {
  ChevronDown,
  ChevronRight,
  Milestone,
  CheckCircle2,
  Clock,
  Circle,
  FolderTree,
  Calendar,
  User,
  Plus,
} from 'lucide-react';

interface WbsTreeViewProps {
  project: Project;
  tasks: TaskItem[];
  onSelectTask: (taskId: string) => void;
  onEditTask: (task: TaskItem) => void;
}

export const WbsTreeView: React.FC<WbsTreeViewProps> = ({
  project,
  tasks,
  onSelectTask,
  onEditTask,
}) => {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group tasks by parentId (hierarchical tree)
  const rootTasks = tasks.filter((t) => t.level === 0 || !t.parentId);
  const getChildTasks = (parentId: string) => tasks.filter((t) => t.parentId === parentId);

  const renderTaskCard = (task: TaskItem) => {
    const children = getChildTasks(task.id);
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedNodes.has(task.id);

    return (
      <div key={task.id} className="relative flex flex-col items-start my-2">
        {/* Task Card Node */}
        <div
          onClick={() => onSelectTask(task.id)}
          onDoubleClick={() => onEditTask(task)}
          className={`w-72 sm:w-80 rounded-xl border p-3.5 shadow-sm bg-white hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer select-none ${
            task.isSummary ? 'border-slate-300 ring-1 ring-slate-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
              WBS {task.wbs}
            </span>
            <div className="flex items-center gap-1.5">
              {task.isMilestone && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-sm">
                  <Milestone className="w-3 h-3 text-amber-500" /> Milestone
                </span>
              )}
              {task.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : task.status === 'in_progress' ? (
                <Clock className="w-4 h-4 text-blue-500" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300" />
              )}
            </div>
          </div>

          <h4 className="text-xs font-bold text-slate-900 line-clamp-2 mb-2">
            {task.name}
          </h4>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2 mb-2">
            <div className="flex items-center gap-1 truncate">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{task.startDate}</span>
            </div>
            <div className="flex items-center gap-1 truncate">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{task.isMilestone ? '0 days' : `${task.duration}d`}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-slate-600">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${task.progress === 100 ? 'bg-emerald-600' : 'bg-emerald-500'}`}
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <span className="font-mono font-bold text-slate-800">{task.progress}%</span>
          </div>

          {task.assignee && (
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-slate-600">
                <User className="w-3 h-3 text-slate-400" /> {task.assignee}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTask(task);
                }}
                className="text-emerald-700 hover:underline text-[10px] font-semibold"
              >
                Edit Details
              </button>
            </div>
          )}

          {/* Expand/Collapse Toggle Button for Summary Nodes */}
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(task.id);
              }}
              className="mt-2 w-full py-1 text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md flex items-center justify-center gap-1 border border-slate-200/80 transition-colors"
            >
              {isCollapsed ? (
                <>
                  <ChevronRight className="w-3.5 h-3.5" /> Show {children.length} Subtasks
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Hide {children.length} Subtasks
                </>
              )}
            </button>
          )}
        </div>

        {/* Subtasks branch */}
        {hasChildren && !isCollapsed && (
          <div className="ml-6 sm:ml-8 pl-4 border-l-2 border-emerald-300/70 mt-2 space-y-2">
            {children.map((child) => renderTaskCard(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      id="view-wbs-tree"
      className="flex-1 h-full overflow-auto bg-slate-50/60 p-4 sm:p-6"
    >
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Project Root Node */}
        <div className="p-4 rounded-xl bg-slate-900 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-600 text-white shrink-0">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-emerald-950 text-emerald-300 font-bold">
                Project Root (WBS 0)
              </span>
              <h2 className="text-base sm:text-lg font-bold mt-1 text-white">{project.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manager: {project.manager || 'Unassigned'} &bull; Start Date: {project.startDate} &bull; Total Elements: {tasks.length}
              </p>
            </div>
          </div>
        </div>

        {/* Root Tasks (Level 0) */}
        <div className="space-y-4 pt-2">
          {rootTasks.map((rootTask) => renderTaskCard(rootTask))}
        </div>
      </div>
    </div>
  );
};
