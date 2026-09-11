import {
  TaskItem,
  TaskBaselineSnapshot,
  ProjectBaselineVersion,
  ResourceAllocationSummary,
  TaskStatus,
} from '../types';

/**
 * Parses date string YYYY-MM-DD into a Date object at UTC midnight
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formats Date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds days to a YYYY-MM-DD date string
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

/**
 * Calculates day difference between two dates: dateB - dateA
 */
export function diffDays(dateAStr: string, dateBStr: string): number {
  const dateA = parseDate(dateAStr);
  const dateB = parseDate(dateBStr);
  const msDiff = dateB.getTime() - dateA.getTime();
  return Math.round(msDiff / (1000 * 60 * 60 * 24));
}

/**
 * Recomputes hierarchical WBS codes (e.g. 1, 1.1, 1.1.1, 1.2, 2)
 * based on task order and level.
 */
export function recalculateWbsCodes(tasks: TaskItem[]): TaskItem[] {
  const counters: number[] = [];
  const parentStack: { id: string; level: number }[] = [];

  const updatedTasks = tasks.map((task) => {
    const level = Math.max(0, task.level || 0);

    // Maintain counters array for current level
    while (counters.length <= level) {
      counters.push(0);
    }
    counters.length = level + 1;
    counters[level] = (counters[level] || 0) + 1;

    // Maintain parent stack for parentId
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
      parentStack.pop();
    }
    const parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null;

    parentStack.push({ id: task.id, level });

    const wbs = counters.slice(0, level + 1).join('.');

    return {
      ...task,
      level,
      wbs,
      parentId,
    };
  });

  // Determine summary tasks (tasks with children)
  const parentIds = new Set(updatedTasks.map((t) => t.parentId).filter(Boolean));

  return updatedTasks.map((task) => ({
    ...task,
    isSummary: parentIds.has(task.id),
  }));
}

/**
 * Rolls up summary task start, finish, duration, and progress from child tasks
 */
export function rollupSummaryTasks(tasks: TaskItem[]): TaskItem[] {
  const taskMap = new Map<string, TaskItem>();
  tasks.forEach((t) => taskMap.set(t.id, { ...t }));

  // Process from deepest level upward
  const maxLevel = Math.max(...tasks.map((t) => t.level), 0);

  for (let l = maxLevel; l >= 0; l--) {
    tasks.forEach((task) => {
      if (task.level === l && task.isSummary) {
        // Find direct and indirect subtasks
        const subtasks = tasks.filter((t) => t.parentId === task.id);
        if (subtasks.length > 0) {
          let minStart = subtasks[0].startDate;
          let maxDue = subtasks[0].dueDate;
          let totalProgress = 0;
          let totalWeight = 0;

          subtasks.forEach((st) => {
            if (st.startDate < minStart) minStart = st.startDate;
            if (st.dueDate > maxDue) maxDue = st.dueDate;
            const weight = Math.max(1, st.duration);
            totalProgress += st.progress * weight;
            totalWeight += weight;
          });

          const current = taskMap.get(task.id)!;
          current.startDate = minStart;
          current.dueDate = maxDue;
          current.duration = Math.max(1, diffDays(minStart, maxDue) + 1);
          current.progress = totalWeight > 0 ? Math.round(totalProgress / totalWeight) : 0;
          taskMap.set(task.id, current);
        }
      }
    });
  }

  return tasks.map((t) => taskMap.get(t.id) || t);
}

/**
 * Indent task (MS Project Demote): Increases task level if preceded by another task
 */
export function indentTask(tasks: TaskItem[], taskId: string): TaskItem[] {
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index <= 0) return tasks; // Cannot indent first task

  const prevTask = tasks[index - 1];
  const targetTask = tasks[index];

  // Target task cannot be more than 1 level deeper than previous task
  if (targetTask.level > prevTask.level) return tasks;

  const newTasks = [...tasks];
  newTasks[index] = {
    ...targetTask,
    level: targetTask.level + 1,
  };

  return recalculateWbsCodes(newTasks);
}

/**
 * Outdent task (MS Project Promote): Decreases task level
 */
export function outdentTask(tasks: TaskItem[], taskId: string): TaskItem[] {
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return tasks;

  const targetTask = tasks[index];
  if (targetTask.level <= 0) return tasks; // Already top level

  const newTasks = [...tasks];
  newTasks[index] = {
    ...targetTask,
    level: targetTask.level - 1,
  };

  return recalculateWbsCodes(newTasks);
}

/**
 * Calculates variance against baseline in days
 */
export function calculateVariance(task: TaskItem): {
  startVariance: number | null;
  finishVariance: number | null;
  durationVariance: number | null;
} {
  if (!task.baseline) {
    return { startVariance: null, finishVariance: null, durationVariance: null };
  }

  const startVariance = diffDays(task.baseline.startDate, task.startDate);
  const finishVariance = diffDays(task.baseline.dueDate, task.dueDate);
  const durationVariance = task.duration - task.baseline.duration;

  return { startVariance, finishVariance, durationVariance };
}

/**
 * Creates a project baseline version snapshot containing full schedule and resource allocation
 */
export function createBaselineSnapshot(
  projectId: string,
  versionNumber: number,
  name: string,
  description: string,
  createdBy: string,
  tasks: TaskItem[]
): ProjectBaselineVersion {
  const now = new Date().toISOString();

  // Snapshot each task
  const taskSnapshots: TaskBaselineSnapshot[] = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    wbs: t.wbs,
    startDate: t.startDate,
    dueDate: t.dueDate,
    duration: t.duration,
    assignee: t.assignee || 'Unassigned',
    progress: t.progress,
    status: t.status,
    priority: t.priority,
    level: t.level,
    parentId: t.parentId,
    isMilestone: t.isMilestone,
    isSummary: t.isSummary,
    notes: t.notes,
    customFields: t.customFields ? { ...t.customFields } : {},
  }));

  // Resource allocation summary calculation
  const resourceMap = new Map<string, { taskCount: number; totalDays: number }>();
  let earliestDate = tasks[0]?.startDate || '';
  let latestDate = tasks[0]?.dueDate || '';
  let totalDur = 0;

  tasks.forEach((t) => {
    if (!t.isSummary) {
      totalDur += t.duration;
    }
    if (t.startDate && (!earliestDate || t.startDate < earliestDate)) earliestDate = t.startDate;
    if (t.dueDate && (!latestDate || t.dueDate > latestDate)) latestDate = t.dueDate;

    const resName = t.assignee ? t.assignee.trim() : 'Unassigned';
    const curr = resourceMap.get(resName) || { taskCount: 0, totalDays: 0 };
    curr.taskCount += 1;
    curr.totalDays += t.duration;
    resourceMap.set(resName, curr);
  });

  const resources: ResourceAllocationSummary[] = Array.from(resourceMap.entries()).map(
    ([name, data]) => ({
      name,
      taskCount: data.taskCount,
      totalDays: data.totalDays,
    })
  );

  return {
    id: `baseline-${projectId}-v${versionNumber}-${Date.now()}`,
    projectId,
    versionNumber,
    name: name || `Baseline ${versionNumber}`,
    description: description || `Schedule and resource snapshot for baseline version ${versionNumber}`,
    createdAt: now,
    createdBy: createdBy || 'Project Manager',
    tasks: taskSnapshots,
    summary: {
      totalTasks: tasks.length,
      totalDuration: totalDur,
      startDate: earliestDate,
      dueDate: latestDate,
      resources,
    },
  };
}

export type ScopeStatus = 'unchanged' | 'added' | 'removed';

export interface DetailedVarianceItem {
  id: string;
  wbs: string;
  name: string;
  level: number;
  isMilestone: boolean;
  isSummary: boolean;
  scopeStatus: ScopeStatus;

  // Schedule Comparison
  currentStart: string | null;
  baselineStart: string | null;
  startVariance: number | null; // > 0 means started later than baseline

  currentFinish: string | null;
  baselineFinish: string | null;
  finishVariance: number | null; // > 0 means finished later (delayed/slippage)

  currentDuration: number | null;
  baselineDuration: number | null;
  durationVariance: number | null; // > 0 means duration increased

  // Resource Allocation Comparison
  currentAssignee: string;
  baselineAssignee: string | null;
  resourceChanged: boolean;

  // Status & Progress
  currentStatus: TaskStatus | null;
  currentProgress: number | null;
  baselineStatus?: TaskStatus | null;
}

export interface ResourceDelta {
  resourceName: string;
  baselineTasks: number;
  baselineDays: number;
  currentTasks: number;
  currentDays: number;
  deltaDays: number;
  deltaTasks: number;
}

/**
 * Compares current project tasks against a specific baseline version.
 * Detects schedule slippage, scope changes (added/removed tasks), and resource allocation shifts.
 */
export function compareAgainstBaseline(
  currentTasks: TaskItem[],
  baselineVersion: ProjectBaselineVersion
): {
  items: DetailedVarianceItem[];
  stats: {
    totalEvaluated: number;
    onTrackCount: number;
    delayedCount: number;
    aheadCount: number;
    scopeAddedCount: number;
    scopeRemovedCount: number;
    resourceChangedCount: number;
    baselineTotalDuration: number;
    currentTotalDuration: number;
    durationVariance: number;
    milestonesDelayed: number;
  };
  resourceComparison: ResourceDelta[];
} {
  const baselineTaskMap = new Map<string, TaskBaselineSnapshot>();
  baselineVersion.tasks.forEach((t) => baselineTaskMap.set(t.id, t));

  const currentTaskMap = new Map<string, TaskItem>();
  currentTasks.forEach((t) => currentTaskMap.set(t.id, t));

  const items: DetailedVarianceItem[] = [];

  let onTrackCount = 0;
  let delayedCount = 0;
  let aheadCount = 0;
  let scopeAddedCount = 0;
  let scopeRemovedCount = 0;
  let resourceChangedCount = 0;
  let milestonesDelayed = 0;

  // 1. Process tasks present in current project
  currentTasks.forEach((curr) => {
    const base = baselineTaskMap.get(curr.id);

    if (!base) {
      // Scope Added Task (exists in current, but not in baseline)
      scopeAddedCount++;
      items.push({
        id: curr.id,
        wbs: curr.wbs,
        name: curr.name,
        level: curr.level,
        isMilestone: curr.isMilestone,
        isSummary: Boolean(curr.isSummary),
        scopeStatus: 'added',
        currentStart: curr.startDate,
        baselineStart: null,
        startVariance: null,
        currentFinish: curr.dueDate,
        baselineFinish: null,
        finishVariance: null,
        currentDuration: curr.duration,
        baselineDuration: null,
        durationVariance: null,
        currentAssignee: curr.assignee || 'Unassigned',
        baselineAssignee: null,
        resourceChanged: false,
        currentStatus: curr.status,
        currentProgress: curr.progress,
      });
      return;
    }

    // Task exists in both: evaluate schedule slippage and resource shift
    const startVariance = diffDays(base.startDate, curr.startDate);
    const finishVariance = diffDays(base.dueDate, curr.dueDate);
    const durationVariance = curr.duration - base.duration;

    const baseAssignee = base.assignee ? base.assignee.trim() : 'Unassigned';
    const currAssignee = curr.assignee ? curr.assignee.trim() : 'Unassigned';
    const resourceChanged = baseAssignee.toLowerCase() !== currAssignee.toLowerCase();
    if (resourceChanged) resourceChangedCount++;

    if (finishVariance > 0) {
      delayedCount++;
      if (curr.isMilestone) milestonesDelayed++;
    } else if (finishVariance < 0) {
      aheadCount++;
    } else {
      onTrackCount++;
    }

    items.push({
      id: curr.id,
      wbs: curr.wbs,
      name: curr.name,
      level: curr.level,
      isMilestone: curr.isMilestone,
      isSummary: Boolean(curr.isSummary),
      scopeStatus: 'unchanged',
      currentStart: curr.startDate,
      baselineStart: base.startDate,
      startVariance,
      currentFinish: curr.dueDate,
      baselineFinish: base.dueDate,
      finishVariance,
      currentDuration: curr.duration,
      baselineDuration: base.duration,
      durationVariance,
      currentAssignee: currAssignee,
      baselineAssignee: baseAssignee,
      resourceChanged,
      currentStatus: curr.status,
      currentProgress: curr.progress,
      baselineStatus: base.status,
    });
  });

  // 2. Process tasks present in baseline but removed from current project (Scope Removed)
  baselineVersion.tasks.forEach((base) => {
    if (!currentTaskMap.has(base.id)) {
      scopeRemovedCount++;
      items.push({
        id: base.id,
        wbs: base.wbs,
        name: base.name,
        level: base.level,
        isMilestone: base.isMilestone,
        isSummary: Boolean(base.isSummary),
        scopeStatus: 'removed',
        currentStart: null,
        baselineStart: base.startDate,
        startVariance: null,
        currentFinish: null,
        baselineFinish: base.dueDate,
        finishVariance: null,
        currentDuration: null,
        baselineDuration: base.duration,
        durationVariance: null,
        currentAssignee: 'Descoped',
        baselineAssignee: base.assignee || 'Unassigned',
        resourceChanged: true,
        currentStatus: null,
        currentProgress: null,
        baselineStatus: base.status,
      });
    }
  });

  // 3. Resource Workload Comparison
  const resMap = new Map<string, ResourceDelta>();

  // Baseline resources
  baselineVersion.summary.resources.forEach((r) => {
    resMap.set(r.name, {
      resourceName: r.name,
      baselineTasks: r.taskCount,
      baselineDays: r.totalDays,
      currentTasks: 0,
      currentDays: 0,
      deltaDays: -r.totalDays,
      deltaTasks: -r.taskCount,
    });
  });

  // Current resources
  currentTasks.forEach((t) => {
    const resName = t.assignee ? t.assignee.trim() : 'Unassigned';
    const entry = resMap.get(resName) || {
      resourceName: resName,
      baselineTasks: 0,
      baselineDays: 0,
      currentTasks: 0,
      currentDays: 0,
      deltaDays: 0,
      deltaTasks: 0,
    };
    entry.currentTasks += 1;
    entry.currentDays += t.duration;
    entry.deltaDays = entry.currentDays - entry.baselineDays;
    entry.deltaTasks = entry.currentTasks - entry.baselineTasks;
    resMap.set(resName, entry);
  });

  const resourceComparison = Array.from(resMap.values()).sort(
    (a, b) => b.currentDays - a.currentDays
  );

  const baselineTotalDuration = baselineVersion.summary.totalDuration;
  const currentTotalDuration = currentTasks
    .filter((t) => !t.isSummary)
    .reduce((sum, t) => sum + t.duration, 0);

  return {
    items,
    stats: {
      totalEvaluated: items.length,
      onTrackCount,
      delayedCount,
      aheadCount,
      scopeAddedCount,
      scopeRemovedCount,
      resourceChangedCount,
      baselineTotalDuration,
      currentTotalDuration,
      durationVariance: currentTotalDuration - baselineTotalDuration,
      milestonesDelayed,
    },
    resourceComparison,
  };
}

