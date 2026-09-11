import React, { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Clock, AlertCircle, Bookmark, CheckSquare } from 'lucide-react';
import { TaskItem, CustomColumn, TaskPriority, TaskStatus } from '../types';
import { diffDays, addDays, calculateVariance } from '../utils/wbs';

interface TaskEditModalProps {
  isOpen: boolean;
  task: TaskItem | null;
  allTasks: TaskItem[];
  customColumns: CustomColumn[];
  onClose: () => void;
  onSave: (task: TaskItem) => void;
  onDelete: (taskId: string) => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  isOpen,
  task,
  allTasks,
  customColumns,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !task) return null;

  const [name, setName] = useState(task.name);
  const [duration, setDuration] = useState(task.duration);
  const [startDate, setStartDate] = useState(task.startDate);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [progress, setProgress] = useState(task.progress);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assignee, setAssignee] = useState(task.assignee);
  const [isMilestone, setIsMilestone] = useState(task.isMilestone);
  const [dependencies, setDependencies] = useState<string[]>(task.dependencies || []);
  const [notes, setNotes] = useState(task.notes || '');
  const [customFields, setCustomFields] = useState<Record<string, any>>({ ...(task.customFields || {}) });

  useEffect(() => {
    setName(task.name);
    setDuration(task.duration);
    setStartDate(task.startDate);
    setDueDate(task.dueDate);
    setProgress(task.progress);
    setStatus(task.status);
    setPriority(task.priority);
    setAssignee(task.assignee);
    setIsMilestone(task.isMilestone);
    setDependencies(task.dependencies || []);
    setNotes(task.notes || '');
    setCustomFields({ ...(task.customFields || {}) });
  }, [task]);

  // When start date changes, recalculate due date from duration
  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (!isMilestone && duration > 0) {
      setDueDate(addDays(newStart, duration - 1));
    } else {
      setDueDate(newStart);
    }
  };

  // When due date changes, recalculate duration
  const handleDueDateChange = (newDue: string) => {
    setDueDate(newDue);
    if (newDue >= startDate) {
      const newDur = isMilestone ? 0 : Math.max(1, diffDays(startDate, newDue) + 1);
      setDuration(newDur);
    }
  };

  // When duration changes, recalculate due date
  const handleDurationChange = (newDur: number) => {
    setDuration(newDur);
    if (newDur <= 0) {
      setIsMilestone(true);
      setDueDate(startDate);
    } else {
      setIsMilestone(false);
      setDueDate(addDays(startDate, newDur - 1));
    }
  };

  const handleMilestoneToggle = (checked: boolean) => {
    setIsMilestone(checked);
    if (checked) {
      setDuration(0);
      setDueDate(startDate);
    } else {
      setDuration(1);
      setDueDate(startDate);
    }
  };

  const handleProgressChange = (newProgress: number) => {
    setProgress(newProgress);
    if (newProgress === 100) {
      setStatus('completed');
    } else if (newProgress > 0 && status === 'not_started') {
      setStatus('in_progress');
    } else if (newProgress === 0 && status === 'completed') {
      setStatus('not_started');
    }
  };

  const handleCustomFieldChange = (colId: string, val: any) => {
    setCustomFields((prev) => ({
      ...prev,
      [colId]: val,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TaskItem = {
      ...task,
      name: name.trim() || 'Untitled Task',
      duration,
      startDate,
      dueDate,
      progress,
      status,
      priority,
      assignee: assignee.trim(),
      isMilestone,
      dependencies,
      notes: notes.trim(),
      customFields,
    };
    onSave(updated);
    onClose();
  };

  const variance = calculateVariance({ ...task, startDate, dueDate, duration });
  const otherTasks = allTasks.filter((t) => t.id !== task.id);

  return (
    <div
      id="task-edit-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="task-edit-modal-card"
        className="w-full max-w-2xl rounded-xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 rounded-md">
              WBS {task.wbs}
            </span>
            <h3 className="text-base font-bold text-slate-900 truncate max-w-sm">
              Task Information
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="task-edit-form" onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 pr-1">
          {/* Task Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Task Name *
            </label>
            <input
              id="input-task-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
            />
          </div>

          {/* Schedule Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Schedule & Timing
              </span>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  id="checkbox-is-milestone"
                  type="checkbox"
                  checked={isMilestone}
                  onChange={(e) => handleMilestoneToggle(e.target.checked)}
                  className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Milestone (0 days)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Start Date</label>
                <input
                  id="input-task-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Due Date</label>
                <input
                  id="input-task-due"
                  type="date"
                  required
                  min={startDate}
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Duration (Days)</label>
                <input
                  id="input-task-duration"
                  type="number"
                  min={0}
                  disabled={isMilestone}
                  value={duration}
                  onChange={(e) => handleDurationChange(parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Baseline comparison card if available */}
            {task.baseline ? (
              <div className="mt-2 pt-2 border-t border-slate-200/80 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
                  Baseline: {task.baseline.startDate} to {task.baseline.dueDate} ({task.baseline.duration}d)
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                      (variance.finishVariance || 0) > 0
                        ? 'bg-rose-100 text-rose-700'
                        : (variance.finishVariance || 0) < 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Finish Variance:{' '}
                    {(variance.finishVariance || 0) > 0 ? `+${variance.finishVariance}d delayed` : (variance.finishVariance || 0) < 0 ? `${variance.finishVariance}d early` : 'On Schedule'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic">No baseline recorded yet for this project.</div>
            )}
          </div>

          {/* Status & Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                id="select-task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden bg-white"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                id="select-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Progress Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Progress: <span className="font-bold text-slate-900">{progress}%</span>
              </label>
              <div className="flex gap-1">
                {[0, 25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProgressChange(p)}
                    className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm"
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <input
              id="range-task-progress"
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => handleProgressChange(parseInt(e.target.value))}
              className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Assignee / Resource
            </label>
            <input
              id="input-task-assignee"
              type="text"
              placeholder="e.g. Alex Rivera, Sarah Jenkins"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          {/* Dependencies / Predecessors */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Predecessors (Finish-to-Start Dependencies)
            </label>
            <div className="max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-lg space-y-1.5 bg-slate-50">
              {otherTasks.length === 0 ? (
                <div className="text-xs text-slate-400">No other tasks available.</div>
              ) : (
                otherTasks.map((t) => {
                  const isChecked = dependencies.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-100 p-1.5 rounded-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDependencies([...dependencies, t.id]);
                          } else {
                            setDependencies(dependencies.filter((id) => id !== t.id));
                          }
                        }}
                        className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-mono text-slate-500 font-semibold">{t.wbs}</span>
                      <span className="truncate">{t.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Custom Columns Section */}
          {customColumns.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Custom Columns
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customColumns.map((col) => {
                  const val = customFields[col.id] ?? col.defaultValue ?? '';
                  return (
                    <div key={col.id}>
                      <label className="block text-xs text-slate-600 mb-1">{col.name}</label>
                      {col.type === 'checkbox' ? (
                        <label className="flex items-center gap-2 text-xs text-slate-700 mt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) => handleCustomFieldChange(col.id, e.target.checked)}
                            className="rounded-sm border-slate-300 text-emerald-600"
                          />
                          <span>{val ? 'Yes' : 'No'}</span>
                        </label>
                      ) : col.type === 'select' ? (
                        <select
                          value={val}
                          onChange={(e) => handleCustomFieldChange(col.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-hidden"
                        >
                          <option value="">-- None --</option>
                          {(col.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : col.type === 'number' || col.type === 'currency' ? (
                        <input
                          type="number"
                          value={val}
                          onChange={(e) => handleCustomFieldChange(col.id, parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-hidden"
                        />
                      ) : col.type === 'date' ? (
                        <input
                          type="date"
                          value={val}
                          onChange={(e) => handleCustomFieldChange(col.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-hidden"
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleCustomFieldChange(col.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-hidden"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Notes & Deliverable Details
            </label>
            <textarea
              rows={3}
              placeholder="Context, specifications, links, or blocker notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete Task
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              id="btn-save-task"
              type="submit"
              form="task-edit-form"
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
