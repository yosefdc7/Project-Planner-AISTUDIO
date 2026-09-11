export type TaskStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface BaselineData {
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  duration: number;  // in days
  savedAt: string;   // ISO timestamp
  assignee?: string; // Resource allocation snapshot
  version?: number;  // baseline version number (1..100)
  name?: string;     // baseline name
}

export interface TaskBaselineSnapshot {
  id: string;
  name: string;
  wbs: string;
  startDate: string;
  dueDate: string;
  duration: number;
  assignee: string;
  progress: number;
  status: TaskStatus;
  priority: TaskPriority;
  level: number;
  parentId: string | null;
  isMilestone: boolean;
  isSummary?: boolean;
  notes?: string;
  customFields?: Record<string, any>;
}

export interface ResourceAllocationSummary {
  name: string;
  taskCount: number;
  totalDays: number;
}

export interface ProjectBaselineVersion {
  id: string;
  projectId: string;
  versionNumber: number; // 1 to 100 (MS Project style)
  name: string;          // e.g. "Baseline 1: Approved Initial Scope"
  description?: string;  // Rationale / revision notes
  createdAt: string;     // ISO timestamp
  createdBy?: string;    // Author / Manager
  tasks: TaskBaselineSnapshot[];
  summary: {
    totalTasks: number;
    totalDuration: number;
    startDate: string;
    dueDate: string;
    resources: ResourceAllocationSummary[];
  };
}

export interface TaskItem {
  id: string;
  projectId: string;
  wbs: string;            // e.g. "1", "1.1", "1.2.1"
  name: string;
  duration: number;       // in days
  startDate: string;      // YYYY-MM-DD
  dueDate: string;        // YYYY-MM-DD
  progress: number;       // 0 to 100
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dependencies: string[]; // IDs of predecessor tasks
  isMilestone: boolean;
  isSummary?: boolean;    // auto-computed if has children
  level: number;          // 0 = root, 1 = child, etc.
  parentId: string | null;
  collapsed?: boolean;
  baseline: BaselineData | null;
  notes?: string;
  customFields: Record<string, any>;
}

export interface CustomColumn {
  id: string;
  projectId: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'currency' | 'checkbox';
  options?: string[]; // for select type
  defaultValue?: any;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  manager: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  spreadsheetName?: string;
  lastSyncedAt?: string;
  hasBaseline?: boolean;
  baselineSavedAt?: string;
  activeBaselineVersion?: number; // 1 to 100
  baselineVersions?: ProjectBaselineVersion[]; // Up to 100 versions
  createdDate: string;
}

export type ViewMode = 'gantt' | 'wbs_tree' | 'kanban' | 'baseline' | 'sync_hub';
export type TimelineZoom = 'days' | 'weeks' | 'months';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSynced?: string;
  message?: string;
}
