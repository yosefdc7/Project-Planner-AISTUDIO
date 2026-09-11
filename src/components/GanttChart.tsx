import React, { useMemo, useState, useRef } from 'react';
import { Flame, Info, Link2, Workflow, ArrowRight, Trash2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TaskItem, TimelineZoom } from '../types';
import {
  parseDate,
  formatDate,
  addDays,
  diffDays,
  calculateVariance,
  calculateCriticalPath,
  wouldCreateCycle,
} from '../utils/wbs';

interface GanttChartProps {
  tasks: TaskItem[];
  allTasks: TaskItem[];
  timelineZoom: TimelineZoom;
  showBaseline: boolean;
  showCriticalPath?: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onEditTask: (task: TaskItem) => void;
  onAddDependency?: (predecessorId: string, successorId: string) => { success: boolean; error?: string; shiftedCount: number };
  onRemoveDependency?: (predecessorId: string, successorId: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  allTasks,
  timelineZoom,
  showBaseline,
  showCriticalPath = false,
  selectedTaskId,
  onSelectTask,
  onEditTask,
  onAddDependency,
  onRemoveDependency,
  scrollRef,
  onScroll,
}) => {
  const [hoveredTask, setHoveredTask] = useState<TaskItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [linkingSourceTaskId, setLinkingSourceTaskId] = useState<string | null>(null);
  const [selectedDependencyLink, setSelectedDependencyLink] = useState<{
    fromId: string;
    toId: string;
    x: number;
    y: number;
  } | null>(null);
  const [linkingToast, setLinkingToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Compute Critical Path using CPM
  const criticalPathInfo = useMemo(() => {
    return calculateCriticalPath(allTasks);
  }, [allTasks]);

  // Determine timeline boundary
  const { minDate, maxDate, totalDays, columnWidth } = useMemo(() => {
    let earliest = '2026-09-01';
    let latest = '2026-10-31';

    allTasks.forEach((t) => {
      if (t.startDate && t.startDate < earliest) earliest = t.startDate;
      if (t.dueDate && t.dueDate > latest) latest = t.dueDate;
      if (t.baseline) {
        if (t.baseline.startDate < earliest) earliest = t.baseline.startDate;
        if (t.baseline.dueDate > latest) latest = t.baseline.dueDate;
      }
    });

    // Add padding days
    const paddedMin = addDays(earliest, -7);
    const paddedMax = addDays(latest, 14);
    const days = Math.max(1, diffDays(paddedMin, paddedMax) + 1);

    let colW = 34; // default for days
    if (timelineZoom === 'weeks') colW = 18;
    if (timelineZoom === 'months') colW = 8;

    return { minDate: paddedMin, maxDate: paddedMax, totalDays: days, columnWidth: colW };
  }, [allTasks, timelineZoom]);

  // Generate array of calendar days
  const calendarDays = useMemo(() => {
    const days: { dateStr: string; dayNum: number; dayOfWeek: string; isWeekend: boolean }[] = [];
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    for (let i = 0; i < totalDays; i++) {
      const dStr = addDays(minDate, i);
      const dObj = parseDate(dStr);
      const dow = dObj.getUTCDay();
      days.push({
        dateStr: dStr,
        dayNum: dObj.getUTCDate(),
        dayOfWeek: weekdays[dow],
        isWeekend: dow === 0 || dow === 6,
      });
    }
    return days;
  }, [minDate, totalDays]);

  // Today position
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOffsetDays = diffDays(minDate, todayStr);
  const todayLeft = todayOffsetDays >= 0 && todayOffsetDays <= totalDays ? todayOffsetDays * columnWidth : null;

  // Row height
  const ROW_HEIGHT = 37;

  // Task bar calculation
  const getTaskGeometry = (task: TaskItem) => {
    const startOffset = Math.max(0, diffDays(minDate, task.startDate));
    const left = startOffset * columnWidth;

    if (task.isMilestone || task.duration === 0) {
      return { left, width: columnWidth, isMilestone: true };
    }

    const dur = Math.max(1, task.duration || (diffDays(task.startDate, task.dueDate) + 1));
    const width = Math.max(columnWidth, dur * columnWidth);
    return { left, width, isMilestone: false };
  };

  const getBaselineGeometry = (task: TaskItem) => {
    if (!task.baseline) return null;
    const startOffset = Math.max(0, diffDays(minDate, task.baseline.startDate));
    const left = startOffset * columnWidth;
    const dur = Math.max(1, task.baseline.duration);
    const width = Math.max(columnWidth, dur * columnWidth);
    return { left, width };
  };

  // Predecessor dependency links
  const dependencyLinks = useMemo(() => {
    const links: {
      fromId: string;
      toId: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    }[] = [];

    const taskIndexMap = new Map<string, number>();
    tasks.forEach((t, i) => taskIndexMap.set(t.id, i));

    tasks.forEach((targetTask, targetIndex) => {
      (targetTask.dependencies || []).forEach((sourceId) => {
        const sourceIndex = taskIndexMap.get(sourceId);
        const sourceTask = tasks.find((t) => t.id === sourceId);
        if (sourceIndex !== undefined && sourceTask) {
          const sourceGeom = getTaskGeometry(sourceTask);
          const targetGeom = getTaskGeometry(targetTask);

          const startX = sourceGeom.left + sourceGeom.width;
          const startY = sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
          const endX = targetGeom.left;
          const endY = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

          links.push({
            fromId: sourceId,
            toId: targetTask.id,
            startX,
            startY,
            endX,
            endY,
          });
        }
      });
    });

    return links;
  }, [tasks, minDate, columnWidth]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="h-full overflow-auto bg-white select-none relative"
    >
      <div
        className="relative"
        style={{
          width: `${totalDays * columnWidth}px`,
          minHeight: '100%',
        }}
      >
        {/* Sticky Timeline Header */}
        <div className="sticky top-0 bg-slate-100/95 backdrop-blur-xs border-b border-slate-300 z-20 shadow-2xs">
          {/* Upper Header: Months */}
          <div className="h-6 flex border-b border-slate-200 text-[11px] font-bold text-slate-700">
            {calendarDays.map((day, idx) => {
              // Show month label on first day of month or start of timeline
              const isMonthStart = day.dayNum === 1 || idx === 0;
              if (isMonthStart) {
                const dObj = parseDate(day.dateStr);
                const monthName = dObj.toLocaleString('default', { month: 'short', year: 'numeric' });
                return (
                  <div
                    key={`m-${idx}`}
                    className="absolute pl-2 text-slate-800 uppercase tracking-wider font-extrabold flex items-center h-6"
                    style={{ left: `${idx * columnWidth}px` }}
                  >
                    {monthName}
                  </div>
                );
              }
              return null;
            })}
          </div>

          {/* Lower Header: Days */}
          <div className="h-6 flex text-[10px] font-mono font-medium text-slate-500">
            {calendarDays.map((day, idx) => (
              <div
                key={day.dateStr}
                className={`flex flex-col items-center justify-center border-r border-slate-200/80 ${
                  day.isWeekend ? 'bg-slate-200/50 text-slate-400' : 'bg-transparent'
                }`}
                style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px` }}
              >
                {timelineZoom === 'days' ? (
                  <>
                    <span className="text-[9px] leading-tight text-slate-400">{day.dayOfWeek}</span>
                    <span className="font-semibold text-slate-700 leading-tight">{day.dayNum}</span>
                  </>
                ) : (
                  <span>{day.dayNum}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Background Grid Columns (Weekends & Guidelines) */}
        <div className="absolute inset-0 top-12 flex pointer-events-none z-0">
          {calendarDays.map((day) => (
            <div
              key={`col-${day.dateStr}`}
              className={`border-r border-slate-100 ${
                day.isWeekend ? 'bg-slate-50/70' : 'bg-transparent'
              }`}
              style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px` }}
            />
          ))}
        </div>

        {/* Today Marker */}
        {todayLeft !== null && (
          <div
            id="gantt-today-marker"
            className="absolute top-0 bottom-0 z-15 pointer-events-none flex flex-col items-center"
            style={{ left: `${todayLeft}px` }}
          >
            <div className="bg-rose-500 text-white font-bold text-[9px] px-1 py-0.5 rounded-b-xs shadow-xs uppercase tracking-wider">
              Today
            </div>
            <div className="w-0.5 h-full bg-rose-500/80 border-r border-dashed border-rose-300" />
          </div>
        )}

        {/* SVG Dependency Arrows */}
        <svg className="absolute inset-0 top-12 pointer-events-none z-10 w-full h-full">
          <defs>
            <marker
              id="gantt-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
            </marker>
            <marker
              id="gantt-arrow-critical"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#e11d48" />
            </marker>
            <marker
              id="gantt-arrow-muted"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
            </marker>
          </defs>
          {dependencyLinks.map((link, idx) => {
            const isCriticalLink = Boolean(
              showCriticalPath &&
              criticalPathInfo.criticalTaskIds.has(link.fromId) &&
              criticalPathInfo.criticalTaskIds.has(link.toId)
            );

            const midX = link.startX + 12;
            const pathData = `M ${link.startX} ${link.startY} L ${midX} ${link.startY} L ${midX} ${link.endY} L ${link.endX} ${link.endY}`;
            return (
              <g key={`link-${idx}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={isCriticalLink ? '#e11d48' : showCriticalPath ? '#94a3b8' : '#059669'}
                  strokeWidth={isCriticalLink ? '2.5' : '1.5'}
                  strokeDasharray={link.startY > link.endY ? '3,3' : undefined}
                  markerEnd={isCriticalLink ? 'url(#gantt-arrow-critical)' : showCriticalPath ? 'url(#gantt-arrow-muted)' : 'url(#gantt-arrow)'}
                  opacity={isCriticalLink ? 1 : showCriticalPath ? 0.35 : 0.85}
                />
                {/* Thicker interactive hit area for dependency management */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  style={{ pointerEvents: 'stroke' }}
                  className="cursor-pointer hover:stroke-emerald-400/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDependencyLink({
                      fromId: link.fromId,
                      toId: link.toId,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Linking Mode Banner */}
        {linkingSourceTaskId && (
          <div className="sticky top-12 left-0 right-0 z-25 bg-emerald-600 text-white px-4 py-2 flex items-center justify-between shadow-lg text-xs animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-200 animate-pulse" />
              <span>
                <strong>Finish-to-Start Linking:</strong> Click any downstream task to set as successor of &ldquo;{allTasks.find((t) => t.id === linkingSourceTaskId)?.name}&rdquo;.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLinkingSourceTaskId(null)}
              className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 rounded text-xs font-semibold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Cancel Linking
            </button>
          </div>
        )}

        {/* Linking Feedback Toast */}
        {linkingToast && (
          <div
            className={`sticky top-14 left-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs shadow-lg z-30 mb-2 font-medium ${
              linkingToast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}
          >
            {linkingToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{linkingToast.message}</span>
            <button
              onClick={() => setLinkingToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Task Rows & Bars */}
        <div className="relative z-10 mt-0">
          {tasks.map((task, index) => {
            const geom = getTaskGeometry(task);
            const baselineGeom = showBaseline ? getBaselineGeometry(task) : null;
            const isSelected = task.id === selectedTaskId;
            const variance = calculateVariance(task);
            const isCritical = Boolean(showCriticalPath && criticalPathInfo.criticalTaskIds.has(task.id));
            const isDimmed = Boolean(showCriticalPath && !isCritical);
            const isLinkingSource = task.id === linkingSourceTaskId;
            const isLinkingCandidate = Boolean(linkingSourceTaskId && !isLinkingSource);
            const wouldCycle = Boolean(
              isLinkingCandidate && wouldCreateCycle(allTasks, linkingSourceTaskId!, task.id)
            );

            const handleRowClick = () => {
              if (linkingSourceTaskId) {
                if (linkingSourceTaskId === task.id) {
                  setLinkingSourceTaskId(null);
                  return;
                }
                if (wouldCycle) {
                  setLinkingToast({
                    message: `Cannot link: "${allTasks.find((t) => t.id === linkingSourceTaskId)?.name}" already depends on "${task.name}". Circular dependency prevented.`,
                    type: 'error',
                  });
                  return;
                }
                if (onAddDependency) {
                  const res = onAddDependency(linkingSourceTaskId, task.id);
                  if (res.success) {
                    const shiftMsg = res.shiftedCount > 0 ? ` (${res.shiftedCount} dependent task(s) auto-shifted)` : '';
                    setLinkingToast({
                      message: `Successfully linked Finish-to-Start${shiftMsg}!`,
                      type: 'success',
                    });
                  } else {
                    setLinkingToast({
                      message: res.error || 'Failed to create dependency.',
                      type: 'error',
                    });
                  }
                }
                setLinkingSourceTaskId(null);
                return;
              }
              onSelectTask(task.id);
            };

            return (
              <div
                key={task.id}
                onClick={handleRowClick}
                onDoubleClick={() => !linkingSourceTaskId && onEditTask(task)}
                onMouseEnter={(e) => {
                  setHoveredTask(task);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => setHoveredTask(null)}
                className={`h-[37px] border-b border-slate-200/80 relative flex items-center cursor-pointer transition-colors group ${
                  isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'
                } ${isCritical ? 'bg-rose-50/20' : ''} ${
                  isLinkingSource ? 'bg-emerald-100/50 ring-2 ring-emerald-500' : ''
                } ${
                  isLinkingCandidate
                    ? wouldCycle
                      ? 'bg-rose-50/40 cursor-not-allowed'
                      : 'hover:bg-emerald-50/60'
                    : ''
                }`}
              >
                {/* Baseline Bar */}
                {baselineGeom && (
                  <div
                    className="absolute h-1.5 rounded-sm bg-indigo-400/80 border border-indigo-500 z-1"
                    style={{
                      left: `${baselineGeom.left}px`,
                      width: `${baselineGeom.width}px`,
                      bottom: '3px',
                    }}
                    title={`Baseline ${task.baseline?.version ? `v${task.baseline.version}` : ''}: ${task.baseline?.startDate} to ${task.baseline?.dueDate}`}
                  />
                )}

                {/* Main Task Bar */}
                {geom.isMilestone ? (
                  /* Milestone Diamond */
                  <div
                    className={`absolute flex items-center justify-center z-5 transition-opacity ${
                      isDimmed ? 'opacity-40 hover:opacity-100' : 'opacity-100'
                    }`}
                    style={{
                      left: `${geom.left}px`,
                      top: '7px',
                      width: '22px',
                      height: '22px',
                    }}
                  >
                    <div
                      className={`w-3.5 h-3.5 rotate-45 rounded-xs shadow-xs transition-all ${
                        isCritical
                          ? 'bg-rose-600 border-2 border-rose-800 ring-2 ring-rose-300'
                          : showCriticalPath
                          ? 'bg-amber-500/70 border-2 border-amber-600/70'
                          : 'bg-amber-500 border-2 border-amber-600'
                      }`}
                    />
                    <div
                      className={`absolute left-6 text-[10px] whitespace-nowrap flex items-center gap-1 ${
                        isCritical ? 'text-rose-800 font-extrabold' : 'text-slate-700 font-bold'
                      }`}
                    >
                      {isCritical && (
                        <Flame className="w-3 h-3 text-rose-600 fill-rose-500 shrink-0" />
                      )}
                      <span>{task.name} ({task.startDate})</span>
                      {isCritical && (
                        <span className="px-1 py-0.2 bg-rose-100 text-rose-700 border border-rose-300 text-[8px] font-black uppercase rounded-xs">
                          Critical
                        </span>
                      )}
                    </div>
                  </div>
                ) : task.isSummary ? (
                  /* MS Project Summary Bracket */
                  <div
                    className={`absolute z-5 transition-opacity ${
                      isDimmed ? 'opacity-40 hover:opacity-100' : 'opacity-100'
                    }`}
                    style={{
                      left: `${geom.left}px`,
                      width: `${geom.width}px`,
                      top: '9px',
                      height: '14px',
                    }}
                  >
                    <div
                      className={`h-2 rounded-xs relative transition-colors ${
                        isCritical ? 'bg-rose-700' : 'bg-slate-900'
                      }`}
                    >
                      {/* Left bracket barb */}
                      <div
                        className={`absolute -left-1 top-0 w-0 h-0 border-t-8 border-l-4 border-l-transparent ${
                          isCritical ? 'border-t-rose-700' : 'border-t-slate-900'
                        }`}
                      />
                      {/* Right bracket barb */}
                      <div
                        className={`absolute -right-1 top-0 w-0 h-0 border-t-8 border-r-4 border-r-transparent ${
                          isCritical ? 'border-t-rose-700' : 'border-t-slate-900'
                        }`}
                      />
                    </div>
                    {/* Summary Label */}
                    <div
                      className={`absolute left-1 -top-3.5 text-[9px] uppercase tracking-wider whitespace-nowrap flex items-center gap-1 ${
                        isCritical ? 'text-rose-800 font-black' : 'text-slate-800 font-extrabold'
                      }`}
                    >
                      {isCritical && (
                        <Flame className="w-2.5 h-2.5 text-rose-600 fill-rose-500 shrink-0" />
                      )}
                      <span>{task.name}</span>
                      {isCritical && (
                        <span className="px-1 py-0.2 bg-rose-100 text-rose-700 border border-rose-200 text-[8px] font-black rounded-xs">
                          Critical Path
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Normal Task Bar with Progress */
                  <div
                    className={`absolute h-5 rounded-md shadow-xs flex items-center overflow-visible border transition-all z-5 ${
                      isSelected
                        ? isCritical
                          ? 'border-rose-600 ring-2 ring-rose-400'
                          : 'border-emerald-600 ring-2 ring-emerald-400'
                        : isCritical
                        ? 'border-rose-600 bg-rose-100 ring-1 ring-rose-300'
                        : task.priority === 'urgent'
                        ? 'border-rose-400 bg-rose-100'
                        : 'border-emerald-500 bg-emerald-100'
                    } ${isDimmed ? 'opacity-45 hover:opacity-100' : 'opacity-100'}`}
                    style={{
                      left: `${geom.left}px`,
                      width: `${geom.width}px`,
                      top: showBaseline && baselineGeom ? '6px' : '8px',
                    }}
                  >
                    {/* Completion Fill */}
                    <div
                      className={`h-full transition-all rounded-l-md ${
                        isCritical
                          ? task.status === 'completed'
                            ? 'bg-rose-700'
                            : 'bg-rose-500'
                          : task.status === 'completed'
                          ? 'bg-emerald-600'
                          : task.priority === 'urgent'
                          ? 'bg-rose-600'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />

                    {/* Text Label inside or beside bar */}
                    <div className="absolute left-2 flex items-center gap-1 text-[10px] font-semibold drop-shadow-2xs truncate max-w-[90%]">
                      {isCritical && (
                        <Flame className="w-3 h-3 text-rose-700 fill-rose-500 shrink-0 inline-block" />
                      )}
                      <span className={isCritical ? 'text-rose-950 font-bold' : 'text-slate-800'}>
                        {task.name}
                      </span>
                      {isCritical && (
                        <span className="px-1 py-0.1 bg-rose-600 text-white rounded-xs text-[7.5px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
                          CP
                        </span>
                      )}
                    </div>

                    {/* Finish-to-Start Connector Anchor Point */}
                    {onAddDependency && !linkingSourceTaskId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLinkingSourceTaskId(task.id);
                        }}
                        title={`Click to link a successor task (Finish-to-Start) after "${task.name}"`}
                        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-600 hover:bg-emerald-700 border-2 border-white shadow-md z-20 opacity-0 group-hover:opacity-100 hover:scale-125 transition-all flex items-center justify-center cursor-crosshair"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </button>
                    )}

                    {/* Target Indicator during Linking Mode */}
                    {isLinkingCandidate && (
                      <div
                        className={`absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md z-20 flex items-center justify-center ${
                          wouldCycle ? 'bg-rose-500' : 'bg-blue-600 animate-bounce'
                        }`}
                        title={wouldCycle ? 'Cannot link (Circular Dependency)' : `Click to link as successor of "${allTasks.find((t) => t.id === linkingSourceTaskId)?.name}"`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating Critical Path Active Indicator / Legend */}
        {showCriticalPath && (
          <div
            id="gantt-critical-path-legend"
            className="sticky bottom-3 left-4 inline-flex items-center gap-2.5 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-lg border border-rose-200 shadow-md text-xs z-30 pointer-events-auto"
          >
            <div className="flex items-center gap-1.5 font-bold text-rose-700">
              <Flame className="w-4 h-4 fill-rose-500 text-rose-600 animate-pulse" />
              <span>Critical Path Active</span>
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <span className="text-slate-600 text-[11px]">
              <strong className="text-rose-600 font-bold">{criticalPathInfo.criticalCount}</strong> of {allTasks.length} tasks impact project end date (<strong className="text-slate-800">{criticalPathInfo.projectEndDate}</strong>)
            </span>
            <div className="flex items-center gap-2 text-[10px] pl-1 font-medium">
              <span className="inline-flex items-center gap-1 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 border border-rose-700" />
                Critical (0 float)
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/60 border border-emerald-600/60" />
                Slack (has float)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredTask && tooltipPos && (
        <div
          id="gantt-task-tooltip"
          className="fixed z-50 p-3 bg-slate-900/95 text-white rounded-lg shadow-xl border border-slate-700 text-xs pointer-events-none max-w-xs backdrop-blur-xs"
          style={{
            left: `${Math.min(window.innerWidth - 260, tooltipPos.x + 15)}px`,
            top: `${Math.min(window.innerHeight - 200, tooltipPos.y + 15)}px`,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 mb-1.5">
            <span className="font-mono text-emerald-400 font-bold">WBS {hoveredTask.wbs}</span>
            <span className="text-[10px] uppercase font-semibold text-slate-400">
              {hoveredTask.status.replace('_', ' ')}
            </span>
          </div>
          <div className="font-bold text-slate-100 mb-1">{hoveredTask.name}</div>
          <div className="space-y-0.5 text-[11px] text-slate-300">
            <div>
              Start: <span className="font-mono text-white">{hoveredTask.startDate}</span>
            </div>
            <div>
              Finish: <span className="font-mono text-white">{hoveredTask.dueDate}</span>
            </div>
            <div>
              Duration:{' '}
              <span className="font-mono text-white">
                {hoveredTask.isMilestone ? '0 days (Milestone)' : `${hoveredTask.duration} days`}
              </span>
            </div>
            <div>
              Progress: <span className="font-mono text-emerald-300">{hoveredTask.progress}%</span>
            </div>
            {hoveredTask.assignee && (
              <div>
                Assignee: <span className="text-white">{hoveredTask.assignee}</span>
              </div>
            )}

            {/* Critical Path & Slack Info */}
            {criticalPathInfo.criticalTaskIds.has(hoveredTask.id) ? (
              <div className="pt-1.5 mt-1 border-t border-slate-800 text-rose-300 text-[10.5px] flex items-center gap-1.5 font-semibold">
                <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-500/40 shrink-0" />
                <span>Critical Path (0d float — impacts project finish {criticalPathInfo.projectEndDate})</span>
              </div>
            ) : criticalPathInfo.taskSlack[hoveredTask.id] !== undefined ? (
              <div className="pt-1.5 mt-1 border-t border-slate-800 text-slate-300 text-[10.5px] flex items-center justify-between">
                <span>Total Float / Slack:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  +{criticalPathInfo.taskSlack[hoveredTask.id]} days
                </span>
              </div>
            ) : null}

            {hoveredTask.baseline && (
              <div className="pt-1.5 mt-1 border-t border-slate-800 text-indigo-300 text-[10px]">
                <div className="font-semibold text-indigo-200">
                  {hoveredTask.baseline.version ? `Baseline (v${hoveredTask.baseline.version}):` : 'Baseline:'} {hoveredTask.baseline.startDate} to {hoveredTask.baseline.dueDate}
                </div>
                {calculateVariance(hoveredTask).finishVariance !== null && (
                  <div>
                    Variance: {calculateVariance(hoveredTask).finishVariance! > 0 ? `+${calculateVariance(hoveredTask).finishVariance}d delayed` : `${calculateVariance(hoveredTask).finishVariance}d early`}
                  </div>
                )}
                {hoveredTask.baseline.assignee && hoveredTask.baseline.assignee !== hoveredTask.assignee && (
                  <div className="text-amber-300">
                    Baseline Assignee: {hoveredTask.baseline.assignee}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Dependency Link Popover */}
      {selectedDependencyLink && (
        <div
          id="gantt-dependency-popover"
          className="fixed z-50 p-3.5 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 text-xs w-72 backdrop-blur-md animate-in fade-in zoom-in-95"
          style={{
            left: `${Math.min(window.innerWidth - 300, Math.max(16, selectedDependencyLink.x - 140))}px`,
            top: `${Math.min(window.innerHeight - 200, Math.max(16, selectedDependencyLink.y + 15))}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Workflow className="w-4 h-4 text-emerald-600" />
              <span>Dependency Relationship</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDependencyLink(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-sm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Relationship:</span>
              <span className="font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-xs text-[10px]">
                Finish-to-Start (FS)
              </span>
            </div>
            <div className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200/80 space-y-1">
              <div>
                <span className="text-slate-500">Predecessor:</span>{' '}
                <strong className="text-slate-800">
                  {allTasks.find((t) => t.id === selectedDependencyLink.fromId)?.name}
                </strong>
                <span className="text-[10px] text-slate-400 block font-mono">
                  Finishes: {allTasks.find((t) => t.id === selectedDependencyLink.fromId)?.dueDate}
                </span>
              </div>
              <div className="flex items-center justify-center my-0.5 text-emerald-600">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-slate-500">Successor:</span>{' '}
                <strong className="text-slate-800">
                  {allTasks.find((t) => t.id === selectedDependencyLink.toId)?.name}
                </strong>
                <span className="text-[10px] text-slate-400 block font-mono">
                  Starts: {allTasks.find((t) => t.id === selectedDependencyLink.toId)?.startDate}
                </span>
              </div>
            </div>
          </div>
          {onRemoveDependency && (
            <button
              type="button"
              id="btn-remove-dependency-popover"
              onClick={() => {
                onRemoveDependency(selectedDependencyLink.fromId, selectedDependencyLink.toId);
                setSelectedDependencyLink(null);
                setLinkingToast({
                  message: 'Dependency relationship removed.',
                  type: 'success',
                });
              }}
              className="w-full px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Dependency
            </button>
          )}
        </div>
      )}
    </div>
  );
};
