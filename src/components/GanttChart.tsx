import React, { useMemo, useState, useRef } from 'react';
import { TaskItem, TimelineZoom } from '../types';
import { parseDate, formatDate, addDays, diffDays, calculateVariance } from '../utils/wbs';

interface GanttChartProps {
  tasks: TaskItem[];
  allTasks: TaskItem[];
  timelineZoom: TimelineZoom;
  showBaseline: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onEditTask: (task: TaskItem) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  allTasks,
  timelineZoom,
  showBaseline,
  selectedTaskId,
  onSelectTask,
  onEditTask,
  scrollRef,
  onScroll,
}) => {
  const [hoveredTask, setHoveredTask] = useState<TaskItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

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
          </defs>
          {dependencyLinks.map((link, idx) => {
            const midX = link.startX + 12;
            const pathData = `M ${link.startX} ${link.startY} L ${midX} ${link.startY} L ${midX} ${link.endY} L ${link.endX} ${link.endY}`;
            return (
              <path
                key={`link-${idx}`}
                d={pathData}
                fill="none"
                stroke="#059669"
                strokeWidth="1.5"
                strokeDasharray={link.startY > link.endY ? '3,3' : undefined}
                markerEnd="url(#gantt-arrow)"
                opacity="0.85"
              />
            );
          })}
        </svg>

        {/* Task Rows & Bars */}
        <div className="relative z-10 mt-0">
          {tasks.map((task, index) => {
            const geom = getTaskGeometry(task);
            const baselineGeom = showBaseline ? getBaselineGeometry(task) : null;
            const isSelected = task.id === selectedTaskId;
            const variance = calculateVariance(task);

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                onDoubleClick={() => onEditTask(task)}
                onMouseEnter={(e) => {
                  setHoveredTask(task);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => setHoveredTask(null)}
                className={`h-[37px] border-b border-slate-200/80 relative flex items-center cursor-pointer transition-colors ${
                  isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'
                }`}
              >
                {/* Baseline Bar (Rendered slightly below or ghosted) */}
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
                    className="absolute flex items-center justify-center z-5"
                    style={{
                      left: `${geom.left}px`,
                      top: '7px',
                      width: '22px',
                      height: '22px',
                    }}
                  >
                    <div className="w-3.5 h-3.5 bg-amber-500 border-2 border-amber-600 rotate-45 rounded-xs shadow-xs" />
                    <span className="absolute left-6 text-[10px] font-bold text-slate-700 whitespace-nowrap">
                      {task.name} ({task.startDate})
                    </span>
                  </div>
                ) : task.isSummary ? (
                  /* MS Project Summary Bracket */
                  <div
                    className="absolute z-5"
                    style={{
                      left: `${geom.left}px`,
                      width: `${geom.width}px`,
                      top: '9px',
                      height: '14px',
                    }}
                  >
                    <div className="h-2 bg-slate-900 rounded-xs relative">
                      {/* Left bracket barb */}
                      <div className="absolute -left-1 top-0 w-0 h-0 border-t-8 border-t-slate-900 border-l-4 border-l-transparent" />
                      {/* Right bracket barb */}
                      <div className="absolute -right-1 top-0 w-0 h-0 border-t-8 border-t-slate-900 border-r-4 border-r-transparent" />
                    </div>
                    {/* Summary Label */}
                    <span className="absolute left-1 -top-3.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                      {task.name}
                    </span>
                  </div>
                ) : (
                  /* Normal Task Bar with Progress */
                  <div
                    className={`absolute h-5 rounded-md shadow-xs flex items-center overflow-hidden border transition-all z-5 ${
                      isSelected
                        ? 'border-emerald-600 ring-2 ring-emerald-400'
                        : task.priority === 'urgent'
                        ? 'border-rose-400 bg-rose-100'
                        : 'border-emerald-500 bg-emerald-100'
                    }`}
                    style={{
                      left: `${geom.left}px`,
                      width: `${geom.width}px`,
                      top: showBaseline && baselineGeom ? '6px' : '8px',
                    }}
                  >
                    {/* Completion Fill */}
                    <div
                      className={`h-full transition-all ${
                        task.status === 'completed'
                          ? 'bg-emerald-600'
                          : task.priority === 'urgent'
                          ? 'bg-rose-600'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />

                    {/* Text Label inside or beside bar */}
                    <span className="absolute left-2 text-[10px] font-semibold text-slate-800 drop-shadow-2xs truncate max-w-[90%]">
                      {task.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
    </div>
  );
};
