import React, { useState, useRef, useEffect } from 'react';
import { WbsGrid } from './WbsGrid';
import { GanttChart } from './GanttChart';
import { TaskItem, CustomColumn, TimelineZoom } from '../types';
import { Maximize2, Minimize2, Split } from 'lucide-react';

interface SplitViewProps {
  tasks: TaskItem[];
  allTasks: TaskItem[];
  customColumns: CustomColumn[];
  timelineZoom: TimelineZoom;
  showBaseline: boolean;
  showCriticalPath?: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (taskId: string) => void;
  onIndentTask: (taskId: string) => void;
  onOutdentTask: (taskId: string) => void;
  onUpdateTask: (task: TaskItem) => void;
  onAddTask?: () => void;
  onUpdateTaskCustomField: (taskId: string, colId: string, value: any) => void;
  onAddDependency?: (predecessorId: string, successorId: string) => { success: boolean; error?: string; shiftedCount: number };
  onRemoveDependency?: (predecessorId: string, successorId: string) => void;
}

export const SplitView: React.FC<SplitViewProps> = ({
  tasks,
  allTasks,
  customColumns,
  timelineZoom,
  showBaseline,
  showCriticalPath = false,
  selectedTaskId,
  onSelectTask,
  onToggleCollapse,
  onEditTask,
  onDeleteTask,
  onIndentTask,
  onOutdentTask,
  onUpdateTask,
  onAddTask,
  onUpdateTaskCustomField,
  onAddDependency,
  onRemoveDependency,
}) => {
  // Split percentage (default 48% table, 52% gantt)
  const [splitPercent, setSplitPercent] = useState<number>(48);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const ganttScrollRef = useRef<HTMLDivElement | null>(null);

  // Synchronize vertical scroll between table and gantt
  const isSyncingGrid = useRef(false);
  const isSyncingGantt = useRef(false);

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingGrid.current) {
      isSyncingGrid.current = false;
      return;
    }
    if (ganttScrollRef.current) {
      isSyncingGantt.current = true;
      ganttScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingGantt.current) {
      isSyncingGantt.current = false;
      return;
    }
    if (gridScrollRef.current) {
      isSyncingGrid.current = true;
      gridScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Drag handler for splitter
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const newPercent = Math.min(80, Math.max(20, (offsetX / rect.width) * 100));
      setSplitPercent(newPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      id="ms-project-split-container"
      className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white select-none relative"
    >
      {/* Left Pane: WBS Table Grid */}
      <div
        id="pane-wbs-grid"
        className="h-1/2 md:h-full overflow-hidden transition-all duration-75"
        style={{
          width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${splitPercent}%` : '100%',
        }}
      >
        <WbsGrid
          tasks={tasks}
          allTasks={allTasks}
          customColumns={customColumns}
          selectedTaskId={selectedTaskId}
          showBaseline={showBaseline}
          showCriticalPath={showCriticalPath}
          onSelectTask={onSelectTask}
          onToggleCollapse={onToggleCollapse}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onIndentTask={onIndentTask}
          onOutdentTask={onOutdentTask}
          onUpdateTask={onUpdateTask}
          onAddTask={onAddTask}
          onUpdateTaskCustomField={onUpdateTaskCustomField}
          scrollRef={gridScrollRef}
          onScroll={handleGridScroll}
        />
      </div>

      {/* Draggable Splitter Divider */}
      <div
        id="split-view-divider"
        onMouseDown={() => setIsDragging(true)}
        className="hidden md:flex w-2.5 bg-slate-100 hover:bg-emerald-500 active:bg-emerald-600 cursor-col-resize items-center justify-center border-x border-slate-300 transition-colors z-20 group"
        title="Drag to resize WBS Grid and Gantt Chart"
      >
        <div className="w-0.5 h-8 bg-slate-400 group-hover:bg-white rounded-full" />
      </div>

      {/* Right Pane: Interactive Gantt Chart */}
      <div
        id="pane-gantt-chart"
        className="h-1/2 md:h-full flex-1 overflow-hidden transition-all duration-75"
      >
        <GanttChart
          tasks={tasks}
          allTasks={allTasks}
          timelineZoom={timelineZoom}
          showBaseline={showBaseline}
          showCriticalPath={showCriticalPath}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onEditTask={onEditTask}
          onAddDependency={onAddDependency}
          onRemoveDependency={onRemoveDependency}
          scrollRef={ganttScrollRef}
          onScroll={handleGanttScroll}
        />
      </div>
    </div>
  );
};
