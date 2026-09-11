import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Project,
  TaskItem,
  CustomColumn,
  ViewMode,
  TimelineZoom,
  SyncStatus,
  TaskStatus,
  ProjectBaselineVersion,
  TaskBaselineSnapshot,
} from './types';
import {
  initialProjects,
  initialTasks,
  initialCustomColumns,
} from './utils/initialData';
import {
  recalculateWbsCodes,
  rollupSummaryTasks,
  indentTask,
  outdentTask,
  diffDays,
  createBaselineSnapshot,
  calculateCriticalPath,
  shiftDependentTasks,
  addFinishToStartDependency,
  removeFinishToStartDependency,
  autoScheduleAllFinishToStart,
} from './utils/wbs';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
} from './services/auth';
import {
  createProjectSpreadsheet,
  syncProjectToSheet,
  fetchProjectFromSheet,
} from './services/googleSheets';
import { User } from 'firebase/auth';

import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { SplitView } from './components/SplitView';
import { WbsTreeView } from './components/WbsTreeView';
import { KanbanBoard } from './components/KanbanBoard';
import { BaselineVarianceView } from './components/BaselineVarianceView';
import { SheetSyncModal } from './components/SheetSyncModal';
import { TaskEditModal } from './components/TaskEditModal';
import { ProjectModal } from './components/ProjectModal';
import { CustomColumnModal } from './components/CustomColumnModal';
import { SaveBaselineModal } from './components/SaveBaselineModal';
import { BaselineManagerModal } from './components/BaselineManagerModal';
import { DependencyMappingModal } from './components/DependencyMappingModal';
import { ConfirmModal } from './components/ConfirmModal';
import { MobileNav } from './components/MobileNav';

export default function App() {
  // Local storage keys
  const LS_PROJECTS = 'msproject_projects_v2';
  const LS_TASKS = 'msproject_tasks_v2';
  const LS_COLS = 'msproject_cols_v2';
  const LS_CURR_PROJ = 'msproject_active_proj_v2';

  // 1. Projects State
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(LS_PROJECTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load projects from localStorage', e);
    }
    return initialProjects;
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LS_CURR_PROJ);
      if (saved && projects.some((p) => p.id === saved)) return saved;
    } catch (e) {}
    return projects[0]?.id || 'proj-erp-cloud';
  });

  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === currentProjectId) || projects[0];
  }, [projects, currentProjectId]);

  // 2. All Tasks State
  const [allTasks, setAllTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(LS_TASKS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load tasks from localStorage', e);
    }
    return initialTasks;
  });

  // Current project tasks (auto calculated WBS & Summary Rollups)
  const currentProjectTasks = useMemo(() => {
    const projTasks = allTasks.filter((t) => t.projectId === currentProjectId);
    return rollupSummaryTasks(recalculateWbsCodes(projTasks));
  }, [allTasks, currentProjectId]);

  // Critical Path calculation for active project
  const criticalPathInfo = useMemo(() => {
    return calculateCriticalPath(currentProjectTasks);
  }, [currentProjectTasks]);

  // 3. Custom Columns State
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => {
    try {
      const saved = localStorage.getItem(LS_COLS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return initialCustomColumns;
  });

  const currentProjectColumns = useMemo(() => {
    return customColumns.filter((c) => c.projectId === currentProjectId);
  }, [customColumns, currentProjectId]);

  // 4. View & UI States
  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  const [timelineZoom, setTimelineZoom] = useState<TimelineZoom>('days');
  const [showBaseline, setShowBaseline] = useState<boolean>(true);
  const [showCriticalPath, setShowCriticalPath] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSaveBaselineModalOpen, setIsSaveBaselineModalOpen] = useState(false);
  const [isManageBaselinesModalOpen, setIsManageBaselinesModalOpen] = useState(false);
  const [isDependencyModalOpen, setIsDependencyModalOpen] = useState(false);

  // Total Finish-to-Start dependencies count for current project
  const currentProjectDependencyCount = useMemo(() => {
    return currentProjectTasks.reduce((count, task) => count + (task.dependencies?.length || 0), 0);
  }, [currentProjectTasks]);

  // Destructive Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: true,
  });

  // 5. Google Workspace Auth & Google Sheets State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAutoSync, setIsAutoSync] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'offline' });

  // Persistence to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
    } catch (e) {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_TASKS, JSON.stringify(allTasks));
    } catch (e) {}
  }, [allTasks]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLS, JSON.stringify(customColumns));
    } catch (e) {}
  }, [customColumns]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CURR_PROJ, currentProjectId);
    } catch (e) {}
  }, [currentProjectId]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authenticatedUser, token) => {
        setUser(authenticatedUser);
        setAccessToken(token);
        setSyncStatus({ state: 'synced', message: 'Connected to Google' });
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setSyncStatus({ state: 'offline', message: 'Not connected' });
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Google Sign In handler
  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        setSyncStatus({ state: 'synced', message: 'Authenticated' });
      }
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setSyncStatus({ state: 'error', message: err.message || 'Login failed' });
    }
  };

  // Google Sign Out handler
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setSyncStatus({ state: 'offline', message: 'Signed out' });
  };

  // Auto-sync debounced trigger
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoSync = useCallback(() => {
    if (!isAutoSync || !accessToken || !currentProject?.spreadsheetId) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        setSyncStatus({ state: 'syncing', message: 'Auto-syncing to Google Sheet...' });
        await syncProjectToSheet(
          accessToken,
          currentProject.spreadsheetId!,
          currentProject,
          currentProjectTasks,
          currentProjectColumns
        );
        setProjects((prev) =>
          prev.map((p) =>
            p.id === currentProjectId
              ? { ...p, lastSyncedAt: new Date().toISOString() }
              : p
          )
        );
        setSyncStatus({ state: 'synced', message: 'Changes synced to Google Sheets' });
      } catch (err: any) {
        console.error('Auto-sync error:', err);
        setSyncStatus({ state: 'error', message: err.message });
      }
    }, 2500);
  }, [isAutoSync, accessToken, currentProject, currentProjectTasks, currentProjectColumns, currentProjectId]);

  // Push to Google Sheets (Manual)
  const handlePushToSheet = async () => {
    if (!accessToken) {
      handleSignIn();
      return;
    }
    if (!currentProject.spreadsheetId) {
      setIsSyncModalOpen(true);
      return;
    }

    try {
      setSyncStatus({ state: 'syncing', message: 'Uploading project to Google Sheets...' });
      await syncProjectToSheet(
        accessToken,
        currentProject.spreadsheetId,
        currentProject,
        currentProjectTasks,
        currentProjectColumns
      );
      const timestamp = new Date().toISOString();
      setProjects((prev) =>
        prev.map((p) => (p.id === currentProjectId ? { ...p, lastSyncedAt: timestamp } : p))
      );
      setSyncStatus({ state: 'synced', message: 'Successfully updated Google Sheets' });
    } catch (err: any) {
      console.error('Push error:', err);
      setSyncStatus({ state: 'error', message: err.message });
    }
  };

  // Pull from Google Sheets (Manual)
  const handlePullFromSheet = async () => {
    if (!accessToken) {
      handleSignIn();
      return;
    }
    if (!currentProject.spreadsheetId) {
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Pull from Google Sheets?',
      message: 'This will replace the current local tasks and custom columns with the data stored in the Google Spreadsheet.',
      isDestructive: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setSyncStatus({ state: 'syncing', message: 'Reading from Google Sheets...' });
          const result = await fetchProjectFromSheet(
            accessToken,
            currentProject.spreadsheetId!,
            currentProjectId
          );

          // Update Project meta
          if (result.project) {
            setProjects((prev) =>
              prev.map((p) => (p.id === currentProjectId ? { ...p, ...result.project } : p))
            );
          }

          // Replace tasks for this project
          if (result.tasks && result.tasks.length > 0) {
            setAllTasks((prev) => [
              ...prev.filter((t) => t.projectId !== currentProjectId),
              ...result.tasks,
            ]);
          }

          // Replace custom columns
          if (result.customColumns) {
            setCustomColumns((prev) => [
              ...prev.filter((c) => c.projectId !== currentProjectId),
              ...result.customColumns,
            ]);
          }

          setSyncStatus({ state: 'synced', message: 'Project loaded from Google Sheets' });
        } catch (err: any) {
          console.error('Pull error:', err);
          setSyncStatus({ state: 'error', message: err.message });
        }
      },
    });
  };

  // Create brand new Google Sheet
  const handleCreateSheet = async () => {
    if (!accessToken) {
      handleSignIn();
      return;
    }

    try {
      setSyncStatus({ state: 'syncing', message: 'Creating Google Spreadsheet in Drive...' });
      const result = await createProjectSpreadsheet(accessToken, currentProject.name);

      // Now sync initial tasks to the newly created sheet
      await syncProjectToSheet(
        accessToken,
        result.spreadsheetId,
        currentProject,
        currentProjectTasks,
        currentProjectColumns
      );

      const timestamp = new Date().toISOString();
      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProjectId
            ? {
                ...p,
                spreadsheetId: result.spreadsheetId,
                spreadsheetUrl: result.spreadsheetUrl,
                spreadsheetName: result.title,
                lastSyncedAt: timestamp,
              }
            : p
        )
      );

      setSyncStatus({ state: 'synced', message: 'Google Spreadsheet linked and populated' });
    } catch (err: any) {
      console.error('Create sheet failed:', err);
      setSyncStatus({ state: 'error', message: err.message });
    }
  };

  // Link existing Google Sheet
  const handleLinkSheet = (sheetIdOrUrl: string) => {
    let sheetId = sheetIdOrUrl.trim();
    if (sheetId.includes('/d/')) {
      const match = sheetId.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) sheetId = match[1];
    }

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProjectId
          ? {
              ...p,
              spreadsheetId: sheetId,
              spreadsheetUrl: url,
              spreadsheetName: `Google Sheet (${sheetId.substring(0, 8)}...)`,
            }
          : p
      )
    );
    setSyncStatus({ state: 'synced', message: 'Linked Google Sheet' });
  };

  // 6. Task Management Operations (WBS, Add, Indent, Outdent, Baseline)
  const handleAddTask = () => {
    const today = new Date().toISOString().split('T')[0];
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      projectId: currentProjectId,
      wbs: '',
      name: 'New Task',
      duration: 5,
      startDate: today,
      dueDate: today,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
      assignee: '',
      dependencies: [],
      isMilestone: false,
      level: 0,
      parentId: null,
      baseline: null,
      customFields: {},
    };

    setAllTasks((prev) => {
      const projectTasks = prev.filter((t) => t.projectId === currentProjectId);
      const otherTasks = prev.filter((t) => t.projectId !== currentProjectId);
      const updated = [...projectTasks, newTask];
      return [...otherTasks, ...updated];
    });

    setSelectedTaskId(newTask.id);
    triggerAutoSync();
  };

  const handleAddSubtask = () => {
    if (!selectedTaskId) return;
    const parent = currentProjectTasks.find((t) => t.id === selectedTaskId);
    if (!parent) return;

    const today = parent.startDate;
    const newSubtask: TaskItem = {
      id: `task-${Date.now()}`,
      projectId: currentProjectId,
      wbs: '',
      name: `Subtask under ${parent.name}`,
      duration: 3,
      startDate: today,
      dueDate: today,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
      assignee: '',
      dependencies: [],
      isMilestone: false,
      level: parent.level + 1,
      parentId: parent.id,
      baseline: null,
      customFields: {},
    };

    setAllTasks((prev) => {
      const projectTasks = prev.filter((t) => t.projectId === currentProjectId);
      const otherTasks = prev.filter((t) => t.projectId !== currentProjectId);
      const parentIdx = projectTasks.findIndex((t) => t.id === selectedTaskId);
      const updated = [...projectTasks];
      updated.splice(parentIdx + 1, 0, newSubtask);
      return [...otherTasks, ...updated];
    });

    setSelectedTaskId(newSubtask.id);
    triggerAutoSync();
  };

  const handleAddMilestone = () => {
    const today = new Date().toISOString().split('T')[0];
    const newMilestone: TaskItem = {
      id: `task-${Date.now()}`,
      projectId: currentProjectId,
      wbs: '',
      name: 'Key Project Milestone',
      duration: 0,
      startDate: today,
      dueDate: today,
      progress: 0,
      status: 'not_started',
      priority: 'high',
      assignee: '',
      dependencies: [],
      isMilestone: true,
      level: 0,
      parentId: null,
      baseline: null,
      customFields: {},
    };

    setAllTasks((prev) => {
      const projectTasks = prev.filter((t) => t.projectId === currentProjectId);
      const otherTasks = prev.filter((t) => t.projectId !== currentProjectId);
      return [...otherTasks, ...projectTasks, newMilestone];
    });

    setSelectedTaskId(newMilestone.id);
    triggerAutoSync();
  };

  const handleIndent = () => {
    if (!selectedTaskId) return;
    setAllTasks((prev) => {
      const projTasks = prev.filter((t) => t.projectId === currentProjectId);
      const otherTasks = prev.filter((t) => t.projectId !== currentProjectId);
      const indented = indentTask(projTasks, selectedTaskId);
      return [...otherTasks, ...indented];
    });
    triggerAutoSync();
  };

  const handleOutdent = () => {
    if (!selectedTaskId) return;
    setAllTasks((prev) => {
      const projTasks = prev.filter((t) => t.projectId === currentProjectId);
      const otherTasks = prev.filter((t) => t.projectId !== currentProjectId);
      const outdented = outdentTask(projTasks, selectedTaskId);
      return [...otherTasks, ...outdented];
    });
    triggerAutoSync();
  };

  const handleDeleteTask = (taskId: string) => {
    const taskToDelete = currentProjectTasks.find((t) => t.id === taskId);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Task?',
      message: `Are you sure you want to delete "${taskToDelete?.name || 'this task'}"? If this is a summary task, all child tasks will be promoted.`,
      isDestructive: true,
      onConfirm: () => {
        setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
        if (selectedTaskId === taskId) setSelectedTaskId(null);
        setIsTaskModalOpen(false);
        setConfirmModal((m) => ({ ...m, isOpen: false }));
        triggerAutoSync();
      },
    });
  };

  const handleSaveTask = (updatedTask: TaskItem) => {
    setAllTasks((prev) => {
      const oldTask = prev.find((t) => t.id === updatedTask.id);
      const oldDueDate = oldTask?.dueDate;
      const updated = prev.map((t) => (t.id === updatedTask.id ? updatedTask : t));
      const currentProjOnly = updated.filter((t) => t.projectId === currentProjectId);
      const others = updated.filter((t) => t.projectId !== currentProjectId);

      // Automatically shift dependent tasks based on Finish-to-Start relationships
      const shiftResult = shiftDependentTasks(currentProjOnly, updatedTask.id, oldDueDate);
      return [...others, ...shiftResult.updatedTasks];
    });
    setIsTaskModalOpen(false);
    triggerAutoSync();
  };

  const handleUpdateTask = (updatedTask: TaskItem) => {
    setAllTasks((prev) => {
      const oldTask = prev.find((t) => t.id === updatedTask.id);
      const oldDueDate = oldTask?.dueDate;
      const updated = prev.map((t) => (t.id === updatedTask.id ? updatedTask : t));
      const currentProjOnly = updated.filter((t) => t.projectId === currentProjectId);
      const others = updated.filter((t) => t.projectId !== currentProjectId);

      // Automatically shift dependent tasks based on Finish-to-Start relationships
      const shiftResult = shiftDependentTasks(currentProjOnly, updatedTask.id, oldDueDate);
      return [...others, ...shiftResult.updatedTasks];
    });
    triggerAutoSync();
  };

  const handleAddDependency = (predecessorId: string, successorId: string) => {
    let resultOut: { success: boolean; error?: string; shiftedCount: number } = {
      success: false,
      shiftedCount: 0,
    };

    setAllTasks((prev) => {
      const currentProjOnly = prev.filter((t) => t.projectId === currentProjectId);
      const others = prev.filter((t) => t.projectId !== currentProjectId);
      const res = addFinishToStartDependency(currentProjOnly, predecessorId, successorId);
      resultOut = {
        success: res.success,
        error: res.error,
        shiftedCount: res.shiftedCount,
      };
      if (!res.success) return prev;
      return [...others, ...res.updatedTasks];
    });

    if (resultOut.success) {
      triggerAutoSync();
    }
    return resultOut;
  };

  const handleRemoveDependency = (predecessorId: string, successorId: string) => {
    setAllTasks((prev) => {
      const currentProjOnly = prev.filter((t) => t.projectId === currentProjectId);
      const others = prev.filter((t) => t.projectId !== currentProjectId);
      const updatedProjTasks = removeFinishToStartDependency(currentProjOnly, predecessorId, successorId);
      return [...others, ...updatedProjTasks];
    });
    triggerAutoSync();
  };

  const handleAutoScheduleAllDependencies = () => {
    let shifted = 0;
    setAllTasks((prev) => {
      const currentProjOnly = prev.filter((t) => t.projectId === currentProjectId);
      const others = prev.filter((t) => t.projectId !== currentProjectId);
      const res = autoScheduleAllFinishToStart(currentProjOnly);
      shifted = res.shiftedCount;
      return [...others, ...res.updatedTasks];
    });
    triggerAutoSync();
    return { shiftedCount: shifted };
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setAllTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const progress = newStatus === 'completed' ? 100 : newStatus === 'not_started' ? 0 : t.progress;
          return { ...t, status: newStatus, progress };
        }
        return t;
      })
    );
    triggerAutoSync();
  };

  const handleUpdateTaskCustomField = (taskId: string, colId: string, value: any) => {
    setAllTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, customFields: { ...(t.customFields || {}), [colId]: value } }
          : t
      )
    );
    triggerAutoSync();
  };

  const handleToggleCollapse = (taskId: string) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, collapsed: !t.collapsed } : t))
    );
  };

  // 7. Baseline Operations (Up to 100 Versions with Resource Allocation Snapshots)
  const handleSaveBaselineVersion = (
    versionNumber: number,
    name: string,
    description: string,
    setAsActive: boolean
  ) => {
    const creator = user?.displayName || currentProject.manager || 'Project Manager';
    const snapshot = createBaselineSnapshot(
      currentProjectId,
      versionNumber,
      name,
      description,
      creator,
      currentProjectTasks
    );

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== currentProjectId) return p;
        const existingList = p.baselineVersions || [];
        // Replace if versionNumber already exists, otherwise insert sorted by versionNumber
        const filtered = existingList.filter((v) => v.versionNumber !== versionNumber);
        const updatedList = [...filtered, snapshot].sort((a, b) => a.versionNumber - b.versionNumber);

        return {
          ...p,
          hasBaseline: true,
          baselineSavedAt: snapshot.createdAt,
          activeBaselineVersion: setAsActive ? versionNumber : p.activeBaselineVersion || versionNumber,
          baselineVersions: updatedList,
        };
      })
    );

    if (setAsActive) {
      // Update the active baseline overlay on all current tasks
      setAllTasks((prev) =>
        prev.map((t) => {
          if (t.projectId === currentProjectId) {
            return {
              ...t,
              baseline: {
                startDate: t.startDate,
                dueDate: t.dueDate,
                duration: t.duration,
                savedAt: snapshot.createdAt,
                version: versionNumber,
                assignee: t.assignee,
              },
            };
          }
          return t;
        })
      );
      setShowBaseline(true);
    }

    triggerAutoSync();
  };

  const handleSetActiveBaselineVersion = (versionNumber: number) => {
    const targetVersion = (currentProject.baselineVersions || []).find(
      (v) => v.versionNumber === versionNumber
    );
    if (!targetVersion) return;

    // Create lookup map of snapshots
    const snapshotMap = new Map<string, TaskBaselineSnapshot>(
      targetVersion.tasks.map((st: TaskBaselineSnapshot) => [st.id, st])
    );

    // Update active version in project
    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProjectId
          ? { ...p, activeBaselineVersion: versionNumber, hasBaseline: true }
          : p
      )
    );

    // Update baseline pointers on project tasks
    setAllTasks((prev) =>
      prev.map((t) => {
        if (t.projectId === currentProjectId) {
          const snap = snapshotMap.get(t.id);
          if (snap) {
            return {
              ...t,
              baseline: {
                startDate: snap.startDate,
                dueDate: snap.dueDate,
                duration: snap.duration,
                savedAt: targetVersion.createdAt,
                version: targetVersion.versionNumber,
                assignee: snap.assignee,
              },
            };
          } else {
            // Task was added after this baseline was taken
            return { ...t, baseline: null };
          }
        }
        return t;
      })
    );

    setShowBaseline(true);
    triggerAutoSync();
  };

  const handleDeleteBaselineVersion = (versionNumber: number) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Baseline Version ${versionNumber}?`,
      message: `Are you sure you want to delete Baseline Version ${versionNumber}? Historical schedule and resource variance data for this version will be removed.`,
      isDestructive: true,
      onConfirm: () => {
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== currentProjectId) return p;
            const updated = (p.baselineVersions || []).filter((v) => v.versionNumber !== versionNumber);
            const newActive =
              p.activeBaselineVersion === versionNumber
                ? updated[0]?.versionNumber
                : p.activeBaselineVersion;

            return {
              ...p,
              hasBaseline: updated.length > 0,
              activeBaselineVersion: newActive,
              baselineVersions: updated,
            };
          })
        );

        setConfirmModal((m) => ({ ...m, isOpen: false }));
        triggerAutoSync();
      },
    });
  };

  const handleRevertToBaseline = (version: ProjectBaselineVersion) => {
    setConfirmModal({
      isOpen: true,
      title: `Revert Schedule to Baseline Version ${version.versionNumber}?`,
      message: `This will reset your current project schedule start dates, due dates, durations, and resource assignments back to the snapshot captured in "${version.name}". Any subsequent changes will be overwritten.`,
      isDestructive: true,
      onConfirm: () => {
        const snapshotMap = new Map<string, TaskBaselineSnapshot>(
          version.tasks.map((st: TaskBaselineSnapshot) => [st.id, st])
        );

        setAllTasks((prev) => {
          const updated = prev.map((t) => {
            if (t.projectId !== currentProjectId) return t;
            const snap = snapshotMap.get(t.id);
            if (!snap) return t; // Keep current if not in snapshot

            return {
              ...t,
              startDate: snap.startDate,
              dueDate: snap.dueDate,
              duration: snap.duration,
              assignee: snap.assignee || t.assignee,
              baseline: {
                startDate: snap.startDate,
                dueDate: snap.dueDate,
                duration: snap.duration,
                savedAt: version.createdAt,
                version: version.versionNumber,
                assignee: snap.assignee,
              },
            };
          });

          const currentProjOnly = updated.filter((t) => t.projectId === currentProjectId);
          const others = updated.filter((t) => t.projectId !== currentProjectId);
          return [...others, ...rollupSummaryTasks(recalculateWbsCodes(currentProjOnly))];
        });

        // Set as active baseline
        setProjects((prev) =>
          prev.map((p) =>
            p.id === currentProjectId
              ? {
                  ...p,
                  activeBaselineVersion: version.versionNumber,
                  hasBaseline: true,
                  baselineSavedAt: version.createdAt,
                }
              : p
          )
        );

        setConfirmModal((m) => ({ ...m, isOpen: false }));
        triggerAutoSync();
      },
    });
  };

  const handleClearBaseline = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear All Project Baselines?',
      message: 'This will erase all saved baseline snapshots (up to 100 versions) and variance benchmarks for this project. This cannot be undone.',
      isDestructive: true,
      onConfirm: () => {
        setAllTasks((prev) =>
          prev.map((t) =>
            t.projectId === currentProjectId ? { ...t, baseline: null } : t
          )
        );
        setProjects((prev) =>
          prev.map((p) =>
            p.id === currentProjectId
              ? {
                  ...p,
                  hasBaseline: false,
                  baselineSavedAt: undefined,
                  activeBaselineVersion: undefined,
                  baselineVersions: [],
                }
              : p
          )
        );
        setConfirmModal((m) => ({ ...m, isOpen: false }));
        triggerAutoSync();
      },
    });
  };

  // Filter tasks for grid/gantt based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return currentProjectTasks;
    const query = searchQuery.toLowerCase();
    return currentProjectTasks.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.wbs.includes(query) ||
        (t.assignee && t.assignee.toLowerCase().includes(query))
    );
  }, [currentProjectTasks, searchQuery]);

  return (
    <div id="ms-project-app" className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900">
      {/* Top MS Project Ribbon Navigation */}
      <Navbar
        currentProject={currentProject}
        projects={projects}
        user={user}
        syncStatus={syncStatus}
        onSelectProject={(id) => {
          setCurrentProjectId(id);
          setSelectedTaskId(null);
        }}
        onNewProject={() => {
          setProjectToEdit(null);
          setIsProjectModalOpen(true);
        }}
        onEditProject={() => {
          setProjectToEdit(currentProject);
          setIsProjectModalOpen(true);
        }}
        onOpenSyncHub={() => setIsSyncModalOpen(true)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {/* Ribbon Action Toolbar */}
      <Toolbar
        viewMode={viewMode}
        timelineZoom={timelineZoom}
        showBaseline={showBaseline}
        hasBaseline={Boolean(currentProject.hasBaseline)}
        showCriticalPath={showCriticalPath}
        criticalCount={criticalPathInfo.criticalCount}
        dependencyCount={currentProjectDependencyCount}
        onOpenDependencyMapping={() => setIsDependencyModalOpen(true)}
        baselineVersionsCount={currentProject.baselineVersions?.length || 0}
        activeBaselineVersion={currentProject.activeBaselineVersion}
        selectedTaskId={selectedTaskId}
        searchQuery={searchQuery}
        onViewChange={setViewMode}
        onZoomChange={setTimelineZoom}
        onToggleBaseline={() => setShowBaseline(!showBaseline)}
        onToggleCriticalPath={() => setShowCriticalPath(!showCriticalPath)}
        onSetBaseline={() => setIsSaveBaselineModalOpen(true)}
        onClearBaseline={handleClearBaseline}
        onOpenManageBaselines={() => setIsManageBaselinesModalOpen(true)}
        onAddTask={handleAddTask}
        onAddSubtask={handleAddSubtask}
        onAddMilestone={handleAddMilestone}
        onIndent={handleIndent}
        onOutdent={handleOutdent}
        onAddCustomColumn={() => setIsColumnModalOpen(true)}
        onSearchChange={setSearchQuery}
      />

      {/* Main Workspace Body */}
      <main id="main-workspace" className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
        {viewMode === 'gantt' && (
          <SplitView
            tasks={filteredTasks}
            allTasks={currentProjectTasks}
            customColumns={currentProjectColumns}
            timelineZoom={timelineZoom}
            showBaseline={showBaseline}
            showCriticalPath={showCriticalPath}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onToggleCollapse={handleToggleCollapse}
            onEditTask={(task) => {
              setTaskToEdit(task);
              setIsTaskModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onIndentTask={handleIndent}
            onOutdentTask={handleOutdent}
            onUpdateTask={handleUpdateTask}
            onAddTask={handleAddTask}
            onUpdateTaskCustomField={handleUpdateTaskCustomField}
            onAddDependency={handleAddDependency}
            onRemoveDependency={handleRemoveDependency}
          />
        )}

        {viewMode === 'wbs_tree' && (
          <WbsTreeView
            project={currentProject}
            tasks={filteredTasks}
            onSelectTask={setSelectedTaskId}
            onEditTask={(task) => {
              setTaskToEdit(task);
              setIsTaskModalOpen(true);
            }}
          />
        )}

        {viewMode === 'kanban' && (
          <KanbanBoard
            tasks={filteredTasks}
            onSelectTask={setSelectedTaskId}
            onEditTask={(task) => {
              setTaskToEdit(task);
              setIsTaskModalOpen(true);
            }}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onAddTask={handleAddTask}
          />
        )}

        {viewMode === 'baseline' && (
          <BaselineVarianceView
            project={currentProject}
            tasks={currentProjectTasks}
            baselineVersions={currentProject.baselineVersions || []}
            activeVersionNumber={currentProject.activeBaselineVersion}
            onOpenSaveBaseline={() => setIsSaveBaselineModalOpen(true)}
            onOpenManageBaselines={() => setIsManageBaselinesModalOpen(true)}
            onSetActiveBaseline={handleSetActiveBaselineVersion}
            onClearBaseline={handleClearBaseline}
            onEditTask={(task) => {
              setTaskToEdit(task);
              setIsTaskModalOpen(true);
            }}
            onRevertToBaseline={handleRevertToBaseline}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        viewMode={viewMode}
        onViewChange={setViewMode}
        onOpenSyncHub={() => setIsSyncModalOpen(true)}
        onAddTask={handleAddTask}
      />

      {/* Modals & Drawers */}
      <SaveBaselineModal
        isOpen={isSaveBaselineModalOpen}
        project={currentProject}
        tasks={currentProjectTasks}
        existingVersions={currentProject.baselineVersions || []}
        onClose={() => setIsSaveBaselineModalOpen(false)}
        onSaveBaseline={handleSaveBaselineVersion}
      />

      <BaselineManagerModal
        isOpen={isManageBaselinesModalOpen}
        project={currentProject}
        baselineVersions={currentProject.baselineVersions || []}
        activeVersionNumber={currentProject.activeBaselineVersion}
        onClose={() => setIsManageBaselinesModalOpen(false)}
        onOpenSaveModal={() => setIsSaveBaselineModalOpen(true)}
        onSetActiveVersion={handleSetActiveBaselineVersion}
        onDeleteVersion={handleDeleteBaselineVersion}
        onRevertToVersion={handleRevertToBaseline}
        onSelectCompareVersion={(verNum) => {
          handleSetActiveBaselineVersion(verNum);
          setViewMode('baseline');
        }}
      />

      <DependencyMappingModal
        isOpen={isDependencyModalOpen}
        tasks={currentProjectTasks}
        criticalTaskIds={criticalPathInfo.criticalTaskIds}
        onClose={() => setIsDependencyModalOpen(false)}
        onAddDependency={handleAddDependency}
        onRemoveDependency={handleRemoveDependency}
        onAutoScheduleAll={handleAutoScheduleAllDependencies}
      />

      <TaskEditModal
        isOpen={isTaskModalOpen}
        task={taskToEdit}
        allTasks={currentProjectTasks}
        customColumns={currentProjectColumns}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        projectToEdit={projectToEdit}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={(newOrUpdated) => {
          setProjects((prev) => {
            const exists = prev.some((p) => p.id === newOrUpdated.id);
            if (exists) {
              return prev.map((p) => (p.id === newOrUpdated.id ? newOrUpdated : p));
            }
            return [...prev, newOrUpdated];
          });
          setCurrentProjectId(newOrUpdated.id);
          setIsProjectModalOpen(false);
          triggerAutoSync();
        }}
      />

      <CustomColumnModal
        isOpen={isColumnModalOpen}
        projectId={currentProjectId}
        onClose={() => setIsColumnModalOpen(false)}
        onSave={(col) => {
          setCustomColumns((prev) => [...prev, col]);
          triggerAutoSync();
        }}
      />

      <SheetSyncModal
        isOpen={isSyncModalOpen}
        project={currentProject}
        user={user}
        syncStatus={syncStatus}
        isAutoSync={isAutoSync}
        onClose={() => setIsSyncModalOpen(false)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onCreateSheet={handleCreateSheet}
        onLinkSheet={handleLinkSheet}
        onPushToSheet={handlePushToSheet}
        onPullFromSheet={handlePullFromSheet}
        onToggleAutoSync={setIsAutoSync}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((m) => ({ ...m, isOpen: false }))}
      />
    </div>
  );
}
