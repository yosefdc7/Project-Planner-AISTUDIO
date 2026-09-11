import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Milestone,
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  Edit2,
  Trash2,
  Plus,
  Calendar,
  User,
  Percent,
  Hash,
  Check,
  X,
  Flame,
} from 'lucide-react';
import { TaskItem, CustomColumn, TaskStatus } from '../types';
import { calculateVariance, addDays, diffDays, parseDate, calculateCriticalPath } from '../utils/wbs';

interface WbsGridProps {
  tasks: TaskItem[];
  allTasks: TaskItem[];
  customColumns: CustomColumn[];
  selectedTaskId: string | null;
  showBaseline: boolean;
  showCriticalPath?: boolean;
  onSelectTask: (taskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (taskId: string) => void;
  onIndentTask: (taskId: string) => void;
  onOutdentTask: (taskId: string) => void;
  onUpdateTask: (task: TaskItem) => void;
  onAddTask?: () => void;
  onUpdateTaskCustomField: (taskId: string, colId: string, value: any) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

type EditableField =
  | 'status'
  | 'name'
  | 'duration'
  | 'startDate'
  | 'dueDate'
  | 'progress'
  | 'dependencies'
  | 'assignee'
  | string;

export const WbsGrid: React.FC<WbsGridProps> = ({
  tasks,
  allTasks,
  customColumns,
  selectedTaskId,
  showBaseline,
  showCriticalPath = false,
  onSelectTask,
  onToggleCollapse,
  onEditTask,
  onDeleteTask,
  onIndentTask,
  onOutdentTask,
  onUpdateTask,
  onAddTask,
  onUpdateTaskCustomField,
  scrollRef,
  onScroll,
}) => {
  // Compute Critical Path info
  const criticalPathInfo = useMemo(() => {
    return calculateCriticalPath(allTasks);
  }, [allTasks]);

  // Cell currently being edited
  const [editingCell, setEditingCell] = useState<{
    taskId: string;
    field: EditableField;
  } | null>(null);

  // Transient value for the active input
  const [editValue, setEditValue] = useState<any>('');

  // Status dropdown popover state
  const [statusMenuTaskId, setStatusMenuTaskId] = useState<string | null>(null);

  // Predecessor popover state
  const [predecessorMenuTaskId, setPredecessorMenuTaskId] = useState<string | null>(null);

  // Assignee suggestions dropdown state
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState<boolean>(false);

  // Reference to active input for focus management
  const activeInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // New task inline input state
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [isAddingTaskInline, setIsAddingTaskInline] = useState<boolean>(false);

  // Unique list of all team members / assignees in the project
  const existingAssignees = useMemo(() => {
    const set = new Set<string>();
    allTasks.forEach((t) => {
      if (t.assignee && t.assignee.trim()) {
        set.add(t.assignee.trim());
      }
    });
    return Array.from(set).sort();
  }, [allTasks]);

  // Formats dependencies into comma-separated WBS codes
  const getPredecessorsString = (deps: string[]): string => {
    if (!deps || deps.length === 0) return '';
    return deps
      .map((dId) => {
        const found = allTasks.find((t) => t.id === dId);
        return found ? found.wbs : dId;
      })
      .filter(Boolean)
      .join(', ');
  };

  // Ordered list of editable fields for Tab / Shift+Tab navigation
  const editableFieldList = useMemo<EditableField[]>(() => {
    const list: EditableField[] = [
      'name',
      'duration',
      'startDate',
      'dueDate',
      'progress',
      'dependencies',
      'assignee',
    ];
    customColumns.forEach((c) => {
      list.push(`custom_${c.id}`);
    });
    return list;
  }, [customColumns]);

  // Focus and select input on entering edit mode
  useEffect(() => {
    if (editingCell && activeInputRef.current) {
      activeInputRef.current.focus();
      if ('select' in activeInputRef.current && typeof activeInputRef.current.select === 'function') {
        activeInputRef.current.select();
      }
    }
  }, [editingCell]);

  // Start editing a specific cell
  const startEditing = (taskId: string, field: EditableField) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    onSelectTask(taskId);

    if (field === 'status') {
      setStatusMenuTaskId(taskId);
      return;
    }

    let initialVal: any = '';
    if (field === 'name') initialVal = task.name;
    else if (field === 'duration') initialVal = task.isMilestone ? 0 : task.duration;
    else if (field === 'startDate') initialVal = task.startDate;
    else if (field === 'dueDate') initialVal = task.dueDate;
    else if (field === 'progress') initialVal = task.progress;
    else if (field === 'dependencies') initialVal = getPredecessorsString(task.dependencies);
    else if (field === 'assignee') initialVal = task.assignee || '';
    else if (field.startsWith('custom_')) {
      const colId = field.replace('custom_', '');
      initialVal = task.customFields?.[colId] ?? '';
    }

    setEditValue(initialVal);
    setEditingCell({ taskId, field });
    if (field === 'assignee') setShowAssigneeDropdown(true);
    if (field === 'dependencies') setPredecessorMenuTaskId(taskId);
  };

  // Commit changes made to an inline cell
  const commitEdit = (
    taskId: string,
    field: EditableField,
    valueToSave?: any,
    nextNav?: { direction: 'down' | 'up' | 'next' | 'prev' }
  ) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) {
      setEditingCell(null);
      return;
    }

    const val = valueToSave !== undefined ? valueToSave : editValue;
    const updatedTask: TaskItem = { ...task };

    if (field === 'name') {
      const trimmed = String(val || '').trim();
      if (trimmed) updatedTask.name = trimmed;
    } else if (field === 'duration') {
      const num = Math.max(0, parseInt(val, 10) || 0);
      if (num === 0) {
        updatedTask.duration = 0;
        updatedTask.isMilestone = true;
        updatedTask.dueDate = updatedTask.startDate;
      } else {
        updatedTask.duration = num;
        updatedTask.isMilestone = false;
        updatedTask.dueDate = addDays(updatedTask.startDate, num - 1);
      }
    } else if (field === 'startDate') {
      const newStart = String(val || '');
      if (newStart && !isNaN(parseDate(newStart).getTime())) {
        updatedTask.startDate = newStart;
        const dur = updatedTask.isMilestone ? 0 : Math.max(1, updatedTask.duration);
        updatedTask.dueDate = dur > 0 ? addDays(newStart, dur - 1) : newStart;
      }
    } else if (field === 'dueDate') {
      const newDue = String(val || '');
      if (newDue && !isNaN(parseDate(newDue).getTime())) {
        if (newDue < updatedTask.startDate) {
          updatedTask.startDate = newDue;
          updatedTask.dueDate = newDue;
          updatedTask.duration = updatedTask.isMilestone ? 0 : 1;
        } else {
          updatedTask.dueDate = newDue;
          const diff = diffDays(updatedTask.startDate, newDue);
          if (diff === 0 && updatedTask.isMilestone) {
            updatedTask.duration = 0;
          } else {
            updatedTask.duration = Math.max(1, diff + 1);
          }
        }
      }
    } else if (field === 'progress') {
      let prog = parseInt(val, 10);
      if (isNaN(prog)) prog = 0;
      prog = Math.min(100, Math.max(0, prog));
      updatedTask.progress = prog;
      if (prog === 100) {
        updatedTask.status = 'completed';
      } else if (prog === 0 && updatedTask.status === 'completed') {
        updatedTask.status = 'not_started';
      } else if (prog > 0 && prog < 100 && updatedTask.status === 'not_started') {
        updatedTask.status = 'in_progress';
      }
    } else if (field === 'assignee') {
      updatedTask.assignee = String(val || '').trim();
    } else if (field === 'dependencies') {
      const text = String(val || '');
      const tokens = text
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const newDeps: string[] = [];

      tokens.forEach((token) => {
        // Match by WBS
        const matchByWbs = allTasks.find((t) => t.wbs === token);
        if (matchByWbs && matchByWbs.id !== taskId) {
          if (!newDeps.includes(matchByWbs.id)) newDeps.push(matchByWbs.id);
          return;
        }
        // Match by 1-based row index
        const rowNum = parseInt(token, 10);
        if (!isNaN(rowNum) && rowNum >= 1 && rowNum <= allTasks.length) {
          const matchByRow = allTasks[rowNum - 1];
          if (matchByRow && matchByRow.id !== taskId && !newDeps.includes(matchByRow.id)) {
            newDeps.push(matchByRow.id);
            return;
          }
        }
        // Match by Task ID
        const matchById = allTasks.find((t) => t.id === token);
        if (matchById && matchById.id !== taskId && !newDeps.includes(matchById.id)) {
          newDeps.push(matchById.id);
        }
      });

      updatedTask.dependencies = newDeps;
    } else if (field.startsWith('custom_')) {
      const colId = field.replace('custom_', '');
      updatedTask.customFields = {
        ...(updatedTask.customFields || {}),
        [colId]: val,
      };
      onUpdateTaskCustomField(taskId, colId, val);
    }

    onUpdateTask(updatedTask);

    if (nextNav) {
      navigateCell(taskId, field, nextNav.direction);
    } else {
      setEditingCell(null);
      setShowAssigneeDropdown(false);
      setPredecessorMenuTaskId(null);
    }
  };

  // Quick status update from dropdown
  const handleQuickStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    let progress = task.progress;
    if (newStatus === 'completed') progress = 100;
    else if (newStatus === 'not_started') progress = 0;
    else if (newStatus === 'in_progress' && progress === 0) progress = 25;

    onUpdateTask({
      ...task,
      status: newStatus,
      progress,
    });
    setStatusMenuTaskId(null);
  };

  // Keyboard navigation across cells (Excel / MS Project style)
  const navigateCell = (
    currentTaskId: string,
    currentField: EditableField,
    direction: 'down' | 'up' | 'next' | 'prev'
  ) => {
    const taskIndex = tasks.findIndex((t) => t.id === currentTaskId);
    if (taskIndex === -1) {
      setEditingCell(null);
      return;
    }

    const fieldIndex = editableFieldList.indexOf(currentField);

    if (direction === 'down') {
      if (taskIndex + 1 < tasks.length) {
        startEditing(tasks[taskIndex + 1].id, currentField);
      } else {
        setEditingCell(null);
      }
    } else if (direction === 'up') {
      if (taskIndex - 1 >= 0) {
        startEditing(tasks[taskIndex - 1].id, currentField);
      } else {
        setEditingCell(null);
      }
    } else if (direction === 'next') {
      if (fieldIndex + 1 < editableFieldList.length) {
        startEditing(currentTaskId, editableFieldList[fieldIndex + 1]);
      } else if (taskIndex + 1 < tasks.length) {
        startEditing(tasks[taskIndex + 1].id, editableFieldList[0]);
      } else {
        setEditingCell(null);
      }
    } else if (direction === 'prev') {
      if (fieldIndex - 1 >= 0) {
        startEditing(currentTaskId, editableFieldList[fieldIndex - 1]);
      } else if (taskIndex - 1 >= 0) {
        startEditing(tasks[taskIndex - 1].id, editableFieldList[editableFieldList.length - 1]);
      } else {
        setEditingCell(null);
      }
    }
  };

  // Keydown dispatcher for inputs
  const handleKeyDown = (
    e: React.KeyboardEvent,
    taskId: string,
    field: EditableField
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(taskId, field, editValue, {
        direction: e.shiftKey ? 'up' : 'down',
      });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(taskId, field, editValue, {
        direction: e.shiftKey ? 'prev' : 'next',
      });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
      setShowAssigneeDropdown(false);
      setPredecessorMenuTaskId(null);
    }
  };

  // Inline task adder at bottom
  const handleAddNewTaskInline = () => {
    const trimmed = newTaskName.trim();
    if (!trimmed) {
      setIsAddingTaskInline(false);
      return;
    }

    if (onAddTask) {
      onAddTask();
    }
    setNewTaskName('');
    setIsAddingTaskInline(false);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="h-full overflow-auto bg-white select-none border-r border-slate-200 flex flex-col justify-between"
    >
      <div className="min-w-max">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs border-b border-slate-300 text-slate-700 font-bold z-20 shadow-2xs">
            <tr>
              <th className="py-2.5 px-2 w-10 text-center border-r border-slate-200">#</th>
              <th className="py-2.5 px-2 w-12 text-center border-r border-slate-200">Status</th>
              <th className="py-2.5 px-2.5 w-20 border-r border-slate-200">WBS</th>
              <th className="py-2.5 px-3 min-w-[240px] border-r border-slate-200">Task Name</th>
              <th className="py-2.5 px-2.5 w-24 border-r border-slate-200">Duration</th>
              <th className="py-2.5 px-2.5 w-30 border-r border-slate-200">Start Date</th>
              <th className="py-2.5 px-2.5 w-30 border-r border-slate-200">Finish Date</th>
              <th className="py-2.5 px-2.5 w-32 border-r border-slate-200">% Complete</th>
              <th className="py-2.5 px-2.5 w-28 border-r border-slate-200">Predecessors</th>
              <th className="py-2.5 px-2.5 w-36 border-r border-slate-200">Resource</th>

              {showBaseline && (
                <>
                  <th className="py-2.5 px-2.5 w-28 bg-indigo-50 text-indigo-900 border-r border-indigo-200">
                    Base Start
                  </th>
                  <th className="py-2.5 px-2.5 w-28 bg-indigo-50 text-indigo-900 border-r border-indigo-200">
                    Base Finish
                  </th>
                  <th className="py-2.5 px-2.5 w-24 bg-indigo-50 text-indigo-900 border-r border-indigo-200">
                    Variance
                  </th>
                </>
              )}

              {customColumns.map((col) => (
                <th
                  key={col.id}
                  className="py-2.5 px-2.5 min-w-[120px] max-w-[180px] border-r border-slate-200 truncate bg-slate-50/50"
                  title={col.name}
                >
                  {col.name}
                </th>
              ))}

              <th className="py-2.5 px-2 w-14 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-sans">
            {tasks.map((task, index) => {
              const isSelected = task.id === selectedTaskId;
              const variance = calculateVariance(task);
              const predsStr = getPredecessorsString(task.dependencies);

              const isEditing = (field: EditableField) =>
                editingCell?.taskId === task.id && editingCell?.field === field;
              const isCritical = Boolean(showCriticalPath && criticalPathInfo.criticalTaskIds.has(task.id));

              return (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className={`hover:bg-emerald-50/30 transition-colors group ${
                    isSelected
                      ? 'bg-emerald-50/70 font-medium'
                      : isCritical
                      ? 'bg-rose-50/40 font-normal'
                      : index % 2 === 0
                      ? 'bg-white'
                      : 'bg-slate-50/40'
                  } ${task.isSummary ? 'font-semibold text-slate-900 bg-slate-100/40' : 'text-slate-700'}`}
                >
                  {/* 1. Row Number */}
                  <td className={`py-1.5 px-2 text-center text-[11px] border-r border-slate-200 font-mono ${
                    isCritical ? 'text-rose-600 font-bold' : 'text-slate-400'
                  }`}>
                    {index + 1}
                  </td>

                  {/* 2. Status / Info (Click to toggle inline menu) */}
                  <td
                    className="py-1.5 px-2 text-center border-r border-slate-200 relative cursor-pointer hover:bg-slate-100/80 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusMenuTaskId(statusMenuTaskId === task.id ? null : task.id);
                    }}
                    title="Click to change status"
                  >
                    <div className="flex items-center justify-center">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 inline-block" />
                      ) : task.status === 'in_progress' ? (
                        <Clock className="w-4 h-4 text-blue-500 inline-block" />
                      ) : task.status === 'in_review' ? (
                        <AlertCircle className="w-4 h-4 text-purple-500 inline-block" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 inline-block hover:text-slate-500" />
                      )}
                    </div>

                    {/* Quick Status Dropdown Menu */}
                    {statusMenuTaskId === task.id && (
                      <div
                        id={`status-dropdown-${task.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-2 top-8 z-50 w-36 bg-white rounded-md shadow-lg border border-slate-200 py-1 text-left text-xs font-normal"
                      >
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(task.id, 'not_started')}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 text-slate-700"
                        >
                          <Circle className="w-3.5 h-3.5 text-slate-400" />
                          <span>Not Started</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(task.id, 'in_progress')}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 text-blue-700"
                        >
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span>In Progress</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(task.id, 'in_review')}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 text-purple-700"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-purple-500" />
                          <span>In Review</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(task.id, 'completed')}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 text-emerald-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Completed</span>
                        </button>
                      </div>
                    )}
                  </td>

                  {/* 3. WBS Code */}
                  <td className="py-1.5 px-2.5 font-mono text-[11px] font-bold text-slate-700 border-r border-slate-200">
                    {task.wbs}
                  </td>

                  {/* 4. Task Name (Inline Editable) */}
                  <td
                    className="py-1 px-2 border-r border-slate-200 truncate relative cursor-text hover:bg-emerald-50/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditing('name')) startEditing(task.id, 'name');
                    }}
                  >
                    <div
                      className="flex items-center gap-1.5 min-h-[26px]"
                      style={{ paddingLeft: `${task.level * 16}px` }}
                    >
                      {task.isSummary ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCollapse(task.id);
                          }}
                          className="p-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xs shrink-0"
                        >
                          {task.collapsed ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="w-4.5 shrink-0" />
                      )}

                      {task.isMilestone && (
                        <Milestone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}

                      {isEditing('name') ? (
                        <input
                          ref={activeInputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(task.id, 'name')}
                          onKeyDown={(e) => handleKeyDown(e, task.id, 'name')}
                          className="flex-1 bg-white border border-emerald-500 rounded-xs px-1.5 py-0.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none shadow-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 truncate flex-1 py-0.5">
                          <span
                            className="truncate"
                            title={`${task.name} (Click to edit)`}
                          >
                            {task.name}
                          </span>
                          {showCriticalPath && isCritical && (
                            <span
                              className="px-1 py-0.1 bg-rose-100 text-rose-700 border border-rose-200 text-[8.5px] font-extrabold rounded-xs shrink-0 flex items-center gap-0.5 shadow-2xs"
                              title="Critical Path: Impacts project completion date"
                            >
                              <Flame className="w-2.5 h-2.5 fill-rose-500 text-rose-600" />
                              <span>CP</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 5. Duration (Inline Editable) */}
                  <td
                    className="py-1 px-2 border-r border-slate-200 text-slate-600 font-mono text-[11px] cursor-text hover:bg-emerald-50/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditing('duration')) startEditing(task.id, 'duration');
                    }}
                  >
                    {isEditing('duration') ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={activeInputRef as React.RefObject<HTMLInputElement>}
                          type="number"
                          min="0"
                          max="3650"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(task.id, 'duration')}
                          onKeyDown={(e) => handleKeyDown(e, task.id, 'duration')}
                          className="w-16 bg-white border border-emerald-500 rounded-xs px-1.5 py-0.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400">days</span>
                      </div>
                    ) : (
                      <span title="Click to edit duration">
                        {task.isMilestone ? '0 days' : `${task.duration} ${task.duration === 1 ? 'day' : 'days'}`}
                      </span>
                    )}
                  </td>

                  {/* 6. Start Date (Inline Editable) */}
                  <td
                    className="py-1 px-2 border-r border-slate-200 font-mono text-[11px] cursor-text hover:bg-emerald-50/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditing('startDate')) startEditing(task.id, 'startDate');
                    }}
                  >
                    {isEditing('startDate') ? (
                      <input
                        ref={activeInputRef as React.RefObject<HTMLInputElement>}
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(task.id, 'startDate')}
                        onKeyDown={(e) => handleKeyDown(e, task.id, 'startDate')}
                        className="w-full bg-white border border-emerald-500 rounded-xs px-1 py-0.5 text-[11px] font-mono text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                      />
                    ) : (
                      <span title="Click to edit start date">{task.startDate}</span>
                    )}
                  </td>

                  {/* 7. Finish Date (Inline Editable) */}
                  <td
                    className="py-1 px-2 border-r border-slate-200 font-mono text-[11px] cursor-text hover:bg-emerald-50/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditing('dueDate')) startEditing(task.id, 'dueDate');
                    }}
                  >
                    {isEditing('dueDate') ? (
                      <input
                        ref={activeInputRef as React.RefObject<HTMLInputElement>}
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(task.id, 'dueDate')}
                        onKeyDown={(e) => handleKeyDown(e, task.id, 'dueDate')}
                        className="w-full bg-white border border-emerald-500 rounded-xs px-1 py-0.5 text-[11px] font-mono text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                      />
                    ) : (
                      <span title="Click to edit finish date">{task.dueDate}</span>
                    )}
                  </td>

                  {/* 8. Progress / % Complete (Inline Editable) */}
                  <td
                    className="py-1 px-2 border-r border-slate-200 cursor-text hover:bg-emerald-50/50 relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditing('progress')) startEditing(task.id, 'progress');
                    }}
                  >
                    {isEditing('progress') ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={activeInputRef as React.RefObject<HTMLInputElement>}
                          type="number"
                          min="0"
                          max="100"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(task.id, 'progress')}
                          onKeyDown={(e) => handleKeyDown(e, task.id, 'progress')}
                          className="w-14 bg-white border border-emerald-500 rounded-xs px-1.5 py-0.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                        />
                        <span className="text-xs font-mono text-slate-500">%</span>

                        {/* Quick Preset Buttons */}
                        <div className="hidden sm:flex items-center gap-0.5 ml-1">
                          {[0, 50, 100].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                commitEdit(task.id, 'progress', preset);
                              }}
                              className="px-1 py-0.5 bg-slate-100 hover:bg-emerald-100 text-[9px] font-mono rounded text-slate-600 hover:text-emerald-700"
                            >
                              {preset}%
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2" title="Click to edit progress percentage">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              task.progress === 100
                                ? 'bg-emerald-600'
                                : task.progress > 0
                                ? 'bg-blue-600'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono w-7 text-right font-medium">
                          {task.progress}%
                        </span>
                      </div>
                    )}
                  </td>

                  {/* 9. Predecessors (Inline Editable) */}
                  <td
                    className="py-1 px-2 border-r border-slate-200 font-mono text-[11px] text-slate-600 truncate cursor-text hover:bg-emerald-50/50 relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditing('dependencies')) startEditing(task.id, 'dependencies');
                    }}
                  >
                    {isEditing('dependencies') ? (
                      <div className="relative">
                        <input
                          ref={activeInputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          placeholder="e.g. 1.1, 1.2"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => {
                            // slight delay for clicking popover items
                            setTimeout(() => commitEdit(task.id, 'dependencies'), 150);
                          }}
                          onKeyDown={(e) => handleKeyDown(e, task.id, 'dependencies')}
                          className="w-full bg-white border border-emerald-500 rounded-xs px-1.5 py-0.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                        />

                        {/* Predecessor helper popup */}
                        {predecessorMenuTaskId === task.id && (
                          <div
                            className="absolute left-0 top-7 z-50 w-52 max-h-48 overflow-auto bg-white rounded-md shadow-xl border border-slate-200 p-1.5 text-xs text-left"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <div className="text-[10px] font-bold uppercase text-slate-400 px-1 mb-1">
                              Select Predecessors
                            </div>
                            {allTasks
                              .filter((t) => t.id !== task.id)
                              .map((otherTask) => {
                                const isLinked = task.dependencies.includes(otherTask.id);
                                return (
                                  <button
                                    key={otherTask.id}
                                    type="button"
                                    onClick={() => {
                                      const nextDeps = isLinked
                                        ? task.dependencies.filter((d) => d !== otherTask.id)
                                        : [...task.dependencies, otherTask.id];
                                      const nextStr = getPredecessorsString(nextDeps);
                                      setEditValue(nextStr);
                                      commitEdit(task.id, 'dependencies', nextStr);
                                    }}
                                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-left hover:bg-slate-100 ${
                                      isLinked ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-700'
                                    }`}
                                  >
                                    <span className="truncate">
                                      <span className="font-mono text-slate-400 mr-1">{otherTask.wbs}</span>
                                      {otherTask.name}
                                    </span>
                                    {isLinked && <Check className="w-3 h-3 text-emerald-600 shrink-0 ml-1" />}
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span title="Click to edit predecessors">{predsStr || '-'}</span>
                    )}
                  </td>

                  {/* 10. Resource / Assignee (Inline Editable) */}
                  <td
                    className="py-1 px-2 border-r border-slate-200 truncate cursor-text hover:bg-emerald-50/50 relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditing('assignee')) startEditing(task.id, 'assignee');
                    }}
                  >
                    {isEditing('assignee') ? (
                      <div className="relative">
                        <input
                          ref={activeInputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          placeholder="Type or select name..."
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            setShowAssigneeDropdown(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => commitEdit(task.id, 'assignee'), 150);
                          }}
                          onKeyDown={(e) => handleKeyDown(e, task.id, 'assignee')}
                          className="w-full bg-white border border-emerald-500 rounded-xs px-1.5 py-0.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                        />

                        {/* Assignee suggestions dropdown */}
                        {showAssigneeDropdown && existingAssignees.length > 0 && (
                          <div
                            className="absolute left-0 top-7 z-50 w-44 max-h-40 overflow-auto bg-white rounded-md shadow-xl border border-slate-200 py-1 text-xs text-left"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <div className="text-[10px] font-bold uppercase text-slate-400 px-2.5 py-0.5">
                              Team Members
                            </div>
                            {existingAssignees.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  setEditValue(name);
                                  commitEdit(task.id, 'assignee', name);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1 text-slate-700 hover:bg-slate-100 hover:text-emerald-700 text-left"
                              >
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="truncate">{name}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setEditValue('');
                                commitEdit(task.id, 'assignee', '');
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1 text-slate-400 hover:bg-slate-50 border-t border-slate-100 text-left"
                            >
                              <X className="w-3 h-3" />
                              <span>Clear Assignee</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span title="Click to assign team member">
                        {task.assignee ? (
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-sm text-[10px] font-medium truncate max-w-full">
                            {task.assignee}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Baseline Columns (Informative) */}
                  {showBaseline && (
                    <>
                      <td className="py-1.5 px-2.5 border-r border-indigo-100 bg-indigo-50/30 font-mono text-[11px] text-indigo-950">
                        {task.baseline?.startDate || '-'}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-indigo-100 bg-indigo-50/30 font-mono text-[11px] text-indigo-950">
                        {task.baseline?.dueDate || '-'}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-indigo-100 bg-indigo-50/30 font-mono text-[11px]">
                        {variance.finishVariance !== null ? (
                          <span
                            className={`font-semibold ${
                              variance.finishVariance > 0
                                ? 'text-rose-600'
                                : variance.finishVariance < 0
                                ? 'text-emerald-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {variance.finishVariance > 0
                              ? `+${variance.finishVariance}d`
                              : variance.finishVariance < 0
                              ? `${variance.finishVariance}d`
                              : '0d'}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </>
                  )}

                  {/* Custom Columns (Inline Editable) */}
                  {customColumns.map((col) => {
                    const val = task.customFields?.[col.id] ?? col.defaultValue ?? '';
                    const fieldKey = `custom_${col.id}`;

                    return (
                      <td
                        key={col.id}
                        className="py-1 px-2 border-r border-slate-200 truncate text-[11px] cursor-text hover:bg-emerald-50/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (col.type !== 'checkbox' && !isEditing(fieldKey)) {
                            startEditing(task.id, fieldKey);
                          }
                        }}
                      >
                        {col.type === 'checkbox' ? (
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) => {
                              e.stopPropagation();
                              commitEdit(task.id, fieldKey, e.target.checked);
                            }}
                            className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        ) : isEditing(fieldKey) ? (
                          col.type === 'select' ? (
                            <select
                              ref={activeInputRef as React.RefObject<HTMLSelectElement>}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(task.id, fieldKey)}
                              onKeyDown={(e) => handleKeyDown(e, task.id, fieldKey)}
                              className="w-full bg-white border border-emerald-500 rounded-xs px-1 py-0.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            >
                              <option value="">-- None --</option>
                              {col.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : col.type === 'date' ? (
                            <input
                              ref={activeInputRef as React.RefObject<HTMLInputElement>}
                              type="date"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(task.id, fieldKey)}
                              onKeyDown={(e) => handleKeyDown(e, task.id, fieldKey)}
                              className="w-full bg-white border border-emerald-500 rounded-xs px-1 py-0.5 text-[11px] font-mono text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            />
                          ) : col.type === 'number' || col.type === 'currency' ? (
                            <div className="flex items-center gap-1">
                              {col.type === 'currency' && (
                                <span className="text-slate-400 font-mono">$</span>
                              )}
                              <input
                                ref={activeInputRef as React.RefObject<HTMLInputElement>}
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(task.id, fieldKey)}
                                onKeyDown={(e) => handleKeyDown(e, task.id, fieldKey)}
                                className="w-full bg-white border border-emerald-500 rounded-xs px-1 py-0.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                              />
                            </div>
                          ) : (
                            <input
                              ref={activeInputRef as React.RefObject<HTMLInputElement>}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(task.id, fieldKey)}
                              onKeyDown={(e) => handleKeyDown(e, task.id, fieldKey)}
                              className="w-full bg-white border border-emerald-500 rounded-xs px-1 py-0.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            />
                          )
                        ) : col.type === 'currency' ? (
                          <span className="font-mono font-medium text-emerald-700">
                            {val !== '' ? `$${Number(val).toLocaleString()}` : '-'}
                          </span>
                        ) : col.type === 'select' ? (
                          val ? (
                            <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-800 text-[10px] font-medium">
                              {val}
                            </span>
                          ) : (
                            '-'
                          )
                        ) : (
                          <span className="truncate">{val !== '' ? String(val) : '-'}</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Action Buttons */}
                  <td className="py-1 px-1 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="Edit in Modal"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(task);
                        }}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded-sm"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete Task"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(task.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Quick Add Row at the end */}
            <tr className="bg-slate-50/50 hover:bg-slate-100/70 border-t border-slate-200">
              <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">
                <Plus className="w-3.5 h-3.5 inline-block text-slate-400" />
              </td>
              <td className="py-2 px-2 text-center">
                <Circle className="w-3.5 h-3.5 text-slate-300 inline-block" />
              </td>
              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400">
                {tasks.length + 1}
              </td>
              <td
                colSpan={7 + (showBaseline ? 3 : 0) + customColumns.length + 1}
                className="py-1.5 px-3"
              >
                {onAddTask && (
                  <button
                    type="button"
                    onClick={onAddTask}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Click to add new task (or press Enter from above)</span>
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Spreadsheet Keyboard Navigation Hint Footer */}
      <div className="sticky bottom-0 bg-slate-100/90 backdrop-blur-xs border-t border-slate-200 px-3 py-1 text-[10px] text-slate-500 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Inline Editing:</span>
          <span>Click any cell to edit</span>
          <span className="text-slate-300">|</span>
          <span><kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-[9px] text-slate-700">Tab</kbd> next column</span>
          <span className="text-slate-300">|</span>
          <span><kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-[9px] text-slate-700">Enter</kbd> next row</span>
          <span className="text-slate-300">|</span>
          <span><kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-[9px] text-slate-700">Esc</kbd> cancel</span>
        </div>
        <div className="font-mono text-slate-400">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </div>
      </div>
    </div>
  );
};
