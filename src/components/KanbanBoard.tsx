import React, { useState } from 'react';
import { TaskItem, TaskStatus, TaskPriority } from '../types';
import {
  Clock,
  Calendar,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Milestone,
} from 'lucide-react';

interface KanbanBoardProps {
  tasks: TaskItem[];
  onSelectTask: (taskId: string) => void;
  onEditTask: (task: TaskItem) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask: () => void;
}

interface ColumnDef {
  id: TaskStatus;
  title: string;
  color: string;
  badgeColor: string;
}

const COLUMNS: ColumnDef[] = [
  { id: 'not_started', title: 'Not Started', color: 'border-slate-300 bg-slate-50', badgeColor: 'bg-slate-200 text-slate-700' },
  { id: 'in_progress', title: 'In Progress', color: 'border-blue-300 bg-blue-50/40', badgeColor: 'bg-blue-100 text-blue-800' },
  { id: 'in_review', title: 'In Review', color: 'border-amber-300 bg-amber-50/40', badgeColor: 'bg-amber-100 text-amber-800' },
  { id: 'completed', title: 'Completed', color: 'border-emerald-300 bg-emerald-50/40', badgeColor: 'bg-emerald-100 text-emerald-800' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onSelectTask,
  onEditTask,
  onUpdateTaskStatus,
  onAddTask,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const filteredTasks = tasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const getNextStatus = (current: TaskStatus): TaskStatus | null => {
    if (current === 'not_started') return 'in_progress';
    if (current === 'in_progress') return 'in_review';
    if (current === 'in_review') return 'completed';
    return null;
  };

  const getPrevStatus = (current: TaskStatus): TaskStatus | null => {
    if (current === 'completed') return 'in_review';
    if (current === 'in_review') return 'in_progress';
    if (current === 'in_progress') return 'not_started';
    return null;
  };

  return (
    <div id="view-kanban-board" className="flex-1 h-full overflow-hidden flex flex-col bg-slate-100/70">
      {/* Kanban Filter Bar */}
      <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Filter Priority:
          </span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white outline-hidden"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Cards: <strong className="text-slate-800">{filteredTasks.length}</strong>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 items-stretch">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className={`w-72 sm:w-80 shrink-0 flex flex-col rounded-xl border ${col.color} shadow-xs`}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-slate-200/80 flex items-center justify-between bg-white/70 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {col.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${col.badgeColor}`}
                  >
                    {colTasks.length}
                  </span>
                </div>

                {col.id === 'not_started' && (
                  <button
                    type="button"
                    onClick={onAddTask}
                    className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-slate-200 rounded-md"
                    title="Add task to backlog"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Column Card List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-400 italic border-2 border-dashed border-slate-200 rounded-lg">
                    No tasks in {col.title}
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const nextSt = getNextStatus(task.status);
                    const prevSt = getPrevStatus(task.status);

                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task.id)}
                        onDoubleClick={() => onEditTask(task)}
                        className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-500 transition-all cursor-pointer select-none space-y-2"
                      >
                        {/* WBS & Priority */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] font-bold text-slate-700 px-1.5 py-0.5 bg-slate-100 rounded-sm">
                            WBS {task.wbs}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                              task.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-700'
                                : task.priority === 'high'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2">
                          {task.name}
                        </h4>

                        {/* Timing */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400" /> {task.dueDate}
                          </span>
                          <span className="font-mono">
                            {task.isMilestone ? '0d' : `${task.duration}d`}
                          </span>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{task.progress}%</span>
                        </div>

                        {/* Footer with Assignee & Move Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate max-w-[120px]">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{task.assignee || 'Unassigned'}</span>
                          </span>

                          <div className="flex items-center gap-1">
                            {prevSt && (
                              <button
                                type="button"
                                title={`Move back to ${prevSt.replace('_', ' ')}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTaskStatus(task.id, prevSt);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-sm"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {nextSt && (
                              <button
                                type="button"
                                title={`Advance to ${nextSt.replace('_', ' ')}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTaskStatus(task.id, nextSt);
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-sm"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
