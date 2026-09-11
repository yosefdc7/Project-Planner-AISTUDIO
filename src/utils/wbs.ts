import {
  TaskItem,
  TaskBaselineSnapshot,
  ProjectBaselineVersion,
  ResourceAllocationSummary,
  TaskStatus,
  CriticalPathResult,
  DependencyLinkItem,
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

/**
 * Calculates the Critical Path of the project using the Critical Path Method (CPM).
 * Identifies tasks with zero (or negative) total float that directly dictate
 * the overall project completion date.
 */
export function calculateCriticalPath(tasks: TaskItem[]): CriticalPathResult {
  const result: CriticalPathResult = {
    criticalTaskIds: new Set<string>(),
    taskSlack: {},
    projectEndDate: '',
    projectStartDate: '',
    criticalCount: 0,
  };

  const validTasks = tasks.filter((t) => t.startDate && t.dueDate);
  if (validTasks.length === 0) return result;

  // Determine overall project schedule boundary
  let earliestStart = validTasks[0].startDate;
  let latestDue = validTasks[0].dueDate;

  validTasks.forEach((t) => {
    if (t.startDate < earliestStart) earliestStart = t.startDate;
    if (t.dueDate > latestDue) latestDue = t.dueDate;
  });

  result.projectStartDate = earliestStart;
  result.projectEndDate = latestDue;

  const taskMap = new Map<string, TaskItem>();
  validTasks.forEach((t) => taskMap.set(t.id, t));

  const leafTasks = validTasks.filter((t) => !t.isSummary);

  // Map of predecessors -> successors
  const successorMap = new Map<string, string[]>();
  validTasks.forEach((t) => successorMap.set(t.id, []));

  validTasks.forEach((t) => {
    if (t.dependencies && Array.isArray(t.dependencies)) {
      t.dependencies.forEach((predId) => {
        if (successorMap.has(predId)) {
          successorMap.get(predId)!.push(t.id);
        }
      });
    }
  });

  const getDuration = (t: TaskItem): number => {
    if (t.isMilestone) return 0;
    return Math.max(1, t.duration || (diffDays(t.startDate, t.dueDate) + 1));
  };

  // Backward pass: Initialize Late Finish (LF) and Late Start (LS)
  const lateFinish: Record<string, string> = {};
  const lateStart: Record<string, string> = {};

  leafTasks.forEach((t) => {
    lateFinish[t.id] = latestDue;
    const dur = getDuration(t);
    lateStart[t.id] = dur === 0 ? latestDue : addDays(latestDue, -(dur - 1));
  });

  // Iterative relaxation backward through dependencies
  let changed = true;
  let iterations = 0;
  const maxIterations = Math.min(leafTasks.length + 5, 50);

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const t of leafTasks) {
      const succIds = successorMap.get(t.id) || [];
      const validSuccessors = succIds
        .map((sId) => taskMap.get(sId))
        .filter((s): s is TaskItem => Boolean(s && s.startDate));

      if (validSuccessors.length > 0) {
        let minAllowableLF = latestDue;

        for (const s of validSuccessors) {
          const sLS = lateStart[s.id] || s.startDate;
          // Finish-to-Start constraint: predecessor must finish before or by successor start
          const sameDay = diffDays(t.dueDate, s.startDate) <= 0;
          const allowableFinish = sameDay ? sLS : addDays(sLS, -1);

          if (allowableFinish < minAllowableLF) {
            minAllowableLF = allowableFinish;
          }
        }

        if (minAllowableLF < lateFinish[t.id]) {
          lateFinish[t.id] = minAllowableLF;
          const dur = getDuration(t);
          lateStart[t.id] = dur === 0 ? minAllowableLF : addDays(minAllowableLF, -(dur - 1));
          changed = true;
        }
      }
    }
  }

  // Calculate Slack (Total Float) for leaf tasks
  leafTasks.forEach((t) => {
    const lf = lateFinish[t.id] || latestDue;
    const slack = diffDays(t.dueDate, lf);
    result.taskSlack[t.id] = slack;

    // Zero or negative float directly impacts project completion date
    if (slack <= 0 || t.dueDate === latestDue) {
      result.criticalTaskIds.add(t.id);
    }
  });

  // Driving Predecessors Trace:
  // Ensure tasks on the driving path to the project completion date are included
  const queue = Array.from(result.criticalTaskIds);
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currTask = taskMap.get(currId);
    if (!currTask || !currTask.dependencies || currTask.dependencies.length === 0) continue;

    // Find predecessors
    const preds = currTask.dependencies
      .map((pId) => taskMap.get(pId))
      .filter((p): p is TaskItem => Boolean(p));

    if (preds.length > 0) {
      // Find the driving predecessor(s) with the maximum finish date
      let maxPredDue = preds[0].dueDate;
      preds.forEach((p) => {
        if (p.dueDate > maxPredDue) maxPredDue = p.dueDate;
      });

      preds.forEach((p) => {
        // Predecessor is driving if it finishes at or within weekend buffer (2 days) of maxPredDue
        if (diffDays(p.dueDate, maxPredDue) <= 2) {
          result.criticalTaskIds.add(p.id);
          result.taskSlack[p.id] = 0;
          if (!visited.has(p.id)) {
            visited.add(p.id);
            queue.push(p.id);
          }
        }
      });
    }
  }

  // Summary tasks: Flag if any child task is critical, or if it ends on project finish date
  validTasks.forEach((t) => {
    if (t.isSummary) {
      const hasCriticalChild = validTasks.some(
        (sub) => sub.parentId === t.id && result.criticalTaskIds.has(sub.id)
      );
      if (hasCriticalChild || t.dueDate === latestDue) {
        result.criticalTaskIds.add(t.id);
        result.taskSlack[t.id] = 0;
      } else {
        const children = validTasks.filter((sub) => sub.parentId === t.id);
        const minSlack = children.length > 0
          ? Math.min(...children.map((c) => result.taskSlack[c.id] ?? 999))
          : 0;
        result.taskSlack[t.id] = minSlack;
        if (minSlack <= 0) {
          result.criticalTaskIds.add(t.id);
        }
      }
    }
  });

  result.criticalCount = result.criticalTaskIds.size;
  return result;
}

/**
 * Checks if creating a Finish-to-Start link from predecessorId to successorId
 * would introduce a circular dependency (cycle) in the project schedule.
 */
export function wouldCreateCycle(
  tasks: TaskItem[],
  predecessorId: string,
  successorId: string
): boolean {
  if (predecessorId === successorId) return true;

  const taskMap = new Map<string, TaskItem>(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const queue: string[] = [predecessorId];

  // Traverse upward through predecessorId's existing predecessors.
  // If we can reach successorId, then predecessorId already depends on successorId!
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === successorId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentTask = taskMap.get(currentId);
    if (currentTask && Array.isArray(currentTask.dependencies)) {
      for (const depId of currentTask.dependencies) {
        if (!visited.has(depId)) {
          queue.push(depId);
        }
      }
    }
  }

  return false;
}

/**
 * Automatically shifts dependent task dates when a predecessor's dates change,
 * enforcing Finish-to-Start (FS) relationships across the entire project schedule.
 *
 * Finish-to-Start Rule:
 * A successor task cannot start until all its predecessors have finished.
 * Earliest start date = max(predecessor.dueDate + 1 day) across all predecessors.
 */
export function shiftDependentTasks(
  tasks: TaskItem[],
  changedTaskId?: string,
  oldDueDate?: string
): {
  updatedTasks: TaskItem[];
  shiftedCount: number;
  shiftedTaskNames: string[];
} {
  const taskMap = new Map<string, TaskItem>(tasks.map((t) => [t.id, { ...t }]));
  const shiftedIds = new Set<string>();

  // Helper to get max required start date for a task based on its predecessors
  const getMinAllowedStart = (task: TaskItem): string | null => {
    if (!task.dependencies || task.dependencies.length === 0) return null;

    let maxRequired: string | null = null;
    for (const predId of task.dependencies) {
      const pred = taskMap.get(predId);
      if (pred && pred.dueDate) {
        const earliestAllowed = addDays(pred.dueDate, 1);
        if (!maxRequired || earliestAllowed > maxRequired) {
          maxRequired = earliestAllowed;
        }
      }
    }
    return maxRequired;
  };

  // If a specific task's dates changed, check if immediate successors should follow tightly
  if (changedTaskId && oldDueDate) {
    const changedTask = taskMap.get(changedTaskId);
    if (changedTask && changedTask.dueDate) {
      const delta = diffDays(oldDueDate, changedTask.dueDate);
      if (delta !== 0) {
        for (const task of taskMap.values()) {
          if (task.dependencies && task.dependencies.includes(changedTaskId)) {
            // If the successor started right after the predecessor in the previous schedule
            const wasTightlyLinked = diffDays(oldDueDate, task.startDate) === 1;
            if (wasTightlyLinked) {
              const proposedStart = addDays(task.startDate, delta);
              const minAllowed = getMinAllowedStart(task);
              const newStart = minAllowed && proposedStart < minAllowed ? minAllowed : proposedStart;

              if (newStart !== task.startDate) {
                task.startDate = newStart;
                task.dueDate = task.isMilestone
                  ? newStart
                  : addDays(newStart, Math.max(1, task.duration) - 1);
                shiftedIds.add(task.id);
              }
            }
          }
        }
      }
    }
  }

  // Iterative relaxation pass: Ensure NO task starts before its predecessors finish
  let changed = true;
  let iterations = 0;
  const maxIterations = Math.max(10, tasks.length * 2);

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const task of taskMap.values()) {
      // Leaf or parent with dependencies
      const minAllowed = getMinAllowedStart(task);
      if (minAllowed && task.startDate < minAllowed) {
        task.startDate = minAllowed;
        task.dueDate = task.isMilestone
          ? minAllowed
          : addDays(minAllowed, Math.max(1, task.duration) - 1);
        shiftedIds.add(task.id);
        changed = true;
      }
    }
  }

  // Summary tasks rollup
  const finalTasks = rollupSummaryTasks(Array.from(taskMap.values()));

  const shiftedTaskNames = Array.from(shiftedIds)
    .map((id) => taskMap.get(id)?.name || id)
    .filter(Boolean);

  return {
    updatedTasks: finalTasks,
    shiftedCount: shiftedIds.size,
    shiftedTaskNames,
  };
}

/**
 * Creates a Finish-to-Start relationship between a predecessor and successor task,
 * automatically shifting the successor (and any downstream dependents) if needed.
 */
export function addFinishToStartDependency(
  tasks: TaskItem[],
  predecessorId: string,
  successorId: string
): {
  success: boolean;
  updatedTasks: TaskItem[];
  error?: string;
  shiftedCount: number;
  shiftedTaskNames: string[];
} {
  if (predecessorId === successorId) {
    return {
      success: false,
      updatedTasks: tasks,
      error: 'A task cannot depend on itself.',
      shiftedCount: 0,
      shiftedTaskNames: [],
    };
  }

  const predTask = tasks.find((t) => t.id === predecessorId);
  const succTask = tasks.find((t) => t.id === successorId);

  if (!predTask || !succTask) {
    return {
      success: false,
      updatedTasks: tasks,
      error: 'Predecessor or successor task not found.',
      shiftedCount: 0,
      shiftedTaskNames: [],
    };
  }

  if (wouldCreateCycle(tasks, predecessorId, successorId)) {
    return {
      success: false,
      updatedTasks: tasks,
      error: `Cannot link: "${predTask.name}" already depends on "${succTask.name}". This would create a circular dependency.`,
      shiftedCount: 0,
      shiftedTaskNames: [],
    };
  }

  // Add predecessor to successor's dependencies if not already present
  const currentDeps = succTask.dependencies || [];
  if (currentDeps.includes(predecessorId)) {
    return {
      success: true,
      updatedTasks: tasks,
      shiftedCount: 0,
      shiftedTaskNames: [],
    };
  }

  const newTasks = tasks.map((t) => {
    if (t.id === successorId) {
      return {
        ...t,
        dependencies: [...(t.dependencies || []), predecessorId],
      };
    }
    return t;
  });

  // Shift dependent tasks to enforce the new Finish-to-Start constraint
  const result = shiftDependentTasks(newTasks, predecessorId);

  return {
    success: true,
    updatedTasks: result.updatedTasks,
    shiftedCount: result.shiftedCount,
    shiftedTaskNames: result.shiftedTaskNames,
  };
}

/**
 * Removes a Finish-to-Start relationship between predecessor and successor.
 */
export function removeFinishToStartDependency(
  tasks: TaskItem[],
  predecessorId: string,
  successorId: string
): TaskItem[] {
  const updated = tasks.map((t) => {
    if (t.id === successorId && Array.isArray(t.dependencies)) {
      return {
        ...t,
        dependencies: t.dependencies.filter((id) => id !== predecessorId),
      };
    }
    return t;
  });
  return rollupSummaryTasks(updated);
}

/**
 * Auto-schedules all tasks strictly to Finish-to-Start relationships,
 * compacting unnecessary slack so successors start immediately after their driving predecessor finishes.
 */
export function autoScheduleAllFinishToStart(tasks: TaskItem[]): {
  updatedTasks: TaskItem[];
  shiftedCount: number;
  shiftedTaskNames: string[];
} {
  const taskMap = new Map<string, TaskItem>(tasks.map((t) => [t.id, { ...t }]));
  const shiftedIds = new Set<string>();

  let changed = true;
  let iterations = 0;
  const maxIterations = Math.max(10, tasks.length * 2);

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const task of taskMap.values()) {
      if (task.dependencies && task.dependencies.length > 0) {
        let maxPredDue: string | null = null;
        for (const predId of task.dependencies) {
          const pred = taskMap.get(predId);
          if (pred && pred.dueDate) {
            if (!maxPredDue || pred.dueDate > maxPredDue) {
              maxPredDue = pred.dueDate;
            }
          }
        }

        if (maxPredDue) {
          const tightStart = addDays(maxPredDue, 1);
          if (task.startDate !== tightStart) {
            task.startDate = tightStart;
            task.dueDate = task.isMilestone
              ? tightStart
              : addDays(tightStart, Math.max(1, task.duration) - 1);
            shiftedIds.add(task.id);
            changed = true;
          }
        }
      }
    }
  }

  const finalTasks = rollupSummaryTasks(Array.from(taskMap.values()));
  const shiftedTaskNames = Array.from(shiftedIds)
    .map((id) => taskMap.get(id)?.name || id)
    .filter(Boolean);

  return {
    updatedTasks: finalTasks,
    shiftedCount: shiftedIds.size,
    shiftedTaskNames,
  };
}

/**
 * Extracts and returns an array of all active dependency links in the project,
 * with detailed metadata for display in the Dependency Mapping modal or table.
 */
export function getAllDependencyLinks(
  tasks: TaskItem[],
  criticalTaskIds?: Set<string>
): DependencyLinkItem[] {
  const taskMap = new Map<string, TaskItem>(tasks.map((t) => [t.id, t]));
  const links: DependencyLinkItem[] = [];

  tasks.forEach((task) => {
    if (task.dependencies && task.dependencies.length > 0) {
      task.dependencies.forEach((predId) => {
        const pred = taskMap.get(predId);
        if (pred) {
          const lagDays = diffDays(pred.dueDate, task.startDate) - 1;
          const isDriving = Boolean(
            criticalTaskIds &&
            criticalTaskIds.has(pred.id) &&
            criticalTaskIds.has(task.id)
          );

          links.push({
            id: `${pred.id}->${task.id}`,
            predecessorId: pred.id,
            successorId: task.id,
            predecessorName: pred.name,
            predecessorWbs: pred.wbs,
            predecessorDueDate: pred.dueDate,
            successorName: task.name,
            successorWbs: task.wbs,
            successorStartDate: task.startDate,
            type: 'FS',
            lagDays,
            isDriving,
          });
        }
      });
    }
  });

  return links;
}

