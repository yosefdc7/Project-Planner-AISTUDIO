import { Project, TaskItem, CustomColumn } from '../types';

interface SheetCreationResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

/**
 * Creates a brand new Google Spreadsheet configured for the Project
 */
export async function createProjectSpreadsheet(
  accessToken: string,
  projectName: string
): Promise<SheetCreationResult> {
  const title = `Project Plan - ${projectName} (${new Date().toISOString().split('T')[0]})`;

  const payload = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'Tasks',
          gridProperties: { rowCount: 100, columnCount: 26, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'ProjectInfo',
          gridProperties: { rowCount: 20, columnCount: 10, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'CustomColumns',
          gridProperties: { rowCount: 50, columnCount: 6, frozenRowCount: 1 },
        },
      },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create Google Spreadsheet: ${response.status} ${errorBody}`);
  }

  const result = await response.json();
  const spreadsheetId = result.spreadsheetId;
  const spreadsheetUrl = result.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
  };
}

/**
 * Lists user spreadsheets in Google Drive (created or edited by user)
 */
export async function listUserSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  try {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=25&orderBy=modifiedTime desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.warn('Drive list files failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data.files || [];
  } catch (err) {
    console.warn('Could not query Drive files:', err);
    return [];
  }
}

/**
 * Syncs (writes) the Project, Tasks, and Custom Columns to the Google Spreadsheet
 */
export async function syncProjectToSheet(
  accessToken: string,
  spreadsheetId: string,
  project: Project,
  tasks: TaskItem[],
  customColumns: CustomColumn[]
): Promise<void> {
  // 1. Prepare Tasks sheet headers & rows
  const staticHeaders = [
    'ID',
    'WBS',
    'Task Name',
    'Duration (Days)',
    'Start Date',
    'Due Date',
    'Progress (%)',
    'Status',
    'Priority',
    'Assignee',
    'Predecessors',
    'Is Milestone',
    'Level',
    'Parent ID',
    'Baseline Start',
    'Baseline Due',
    'Baseline Duration',
    'Notes',
  ];

  const customColHeaders = customColumns.map((c) => `Custom: ${c.name}`);
  const taskHeaders = [...staticHeaders, ...customColHeaders];

  const taskRows = tasks.map((t) => {
    const baseRow = [
      t.id,
      t.wbs,
      t.name,
      t.duration,
      t.startDate,
      t.dueDate,
      t.progress,
      t.status,
      t.priority,
      t.assignee,
      (t.dependencies || []).join(', '),
      t.isMilestone ? 'YES' : 'NO',
      t.level,
      t.parentId || '',
      t.baseline?.startDate || '',
      t.baseline?.dueDate || '',
      t.baseline?.duration !== undefined ? t.baseline.duration : '',
      t.notes || '',
    ];

    const customRow = customColumns.map((col) => {
      const val = t.customFields?.[col.id];
      if (val === undefined || val === null) return '';
      return typeof val === 'boolean' ? (val ? 'TRUE' : 'FALSE') : String(val);
    });

    return [...baseRow, ...customRow];
  });

  // 2. Prepare Project Info sheet
  const projectHeaders = ['Property', 'Value'];
  const projectRows = [
    ['Project ID', project.id],
    ['Project Name', project.name],
    ['Description', project.description],
    ['Manager', project.manager],
    ['Start Date', project.startDate],
    ['Status', project.status],
    ['Has Baseline', project.hasBaseline ? 'YES' : 'NO'],
    ['Active Baseline Version', project.activeBaselineVersion ? String(project.activeBaselineVersion) : ''],
    ['Baseline Saved At', project.baselineSavedAt || ''],
    ['Baseline Versions Count', String(project.baselineVersions?.length || 0)],
    ['Baseline Versions Data', JSON.stringify(project.baselineVersions || [])],
    ['Last Synced At', new Date().toISOString()],
  ];

  // 3. Prepare Custom Columns sheet
  const colHeaders = ['ID', 'Name', 'Type', 'Options', 'Default Value'];
  const colRows = customColumns.map((c) => [
    c.id,
    c.name,
    c.type,
    (c.options || []).join(';'),
    c.defaultValue !== undefined ? String(c.defaultValue) : '',
  ]);

  // Batch update values
  const payload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: 'Tasks!A1:Z500',
        values: [taskHeaders, ...taskRows],
      },
      {
        range: 'ProjectInfo!A1:B20',
        values: [projectHeaders, ...projectRows],
      },
      {
        range: 'CustomColumns!A1:E50',
        values: [colHeaders, ...colRows],
      },
    ],
  };

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to sync to Google Sheet: ${response.status} ${errText}`);
  }
}

/**
 * Fetches data from Google Spreadsheet and reconstructs Project, Tasks, and CustomColumns
 */
export async function fetchProjectFromSheet(
  accessToken: string,
  spreadsheetId: string,
  currentProjectId: string
): Promise<{ project: Partial<Project>; tasks: TaskItem[]; customColumns: CustomColumn[] }> {
  const ranges = ['Tasks!A1:Z500', 'ProjectInfo!A1:B20', 'CustomColumns!A1:E50'];
  const rangeQuery = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeQuery}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Unable to fetch spreadsheet data: ${response.status} ${err}`);
  }

  const data = await response.json();
  const valueRanges = data.valueRanges || [];

  // Parse ProjectInfo
  const projectInfoRows = valueRanges[1]?.values || [];
  const projectMeta: Record<string, string> = {};
  for (const row of projectInfoRows.slice(1)) {
    if (row[0]) projectMeta[row[0]] = row[1] || '';
  }

  // Parse Custom Columns
  const customColRows = valueRanges[2]?.values || [];
  const customColumns: CustomColumn[] = [];
  for (const row of customColRows.slice(1)) {
    if (row[0] && row[1]) {
      customColumns.push({
        id: row[0],
        projectId: currentProjectId,
        name: row[1],
        type: (row[2] as any) || 'text',
        options: row[3] ? row[3].split(';').map((s: string) => s.trim()) : [],
        defaultValue: row[4] || '',
      });
    }
  }

  // Parse Tasks
  const taskSheetRows = valueRanges[0]?.values || [];
  const headerRow: string[] = taskSheetRows[0] || [];
  const tasks: TaskItem[] = [];

  for (const row of taskSheetRows.slice(1)) {
    if (!row || !row[1] || !row[2]) continue; // Skip empty rows

    const taskId = row[0] || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const wbs = row[1] || '1';
    const name = row[2] || 'Untitled Task';
    const duration = parseFloat(row[3]) || 1;
    const startDate = row[4] || new Date().toISOString().split('T')[0];
    const dueDate = row[5] || startDate;
    const progress = Math.min(100, Math.max(0, parseInt(row[6]) || 0));
    const status = (row[7] as any) || 'not_started';
    const priority = (row[8] as any) || 'medium';
    const assignee = row[9] || '';
    const depsRaw = row[10] || '';
    const dependencies = depsRaw
      ? depsRaw.split(',').map((d: string) => d.trim()).filter(Boolean)
      : [];
    const isMilestone = row[11] === 'YES' || duration === 0;
    const level = parseInt(row[12]) || 0;
    const parentId = row[13] || null;

    let baseline = null;
    if (row[14] && row[15]) {
      baseline = {
        startDate: row[14],
        dueDate: row[15],
        duration: parseFloat(row[16]) || duration,
        savedAt: new Date().toISOString(),
      };
    }

    const notes = row[17] || '';

    // Custom fields map
    const customFields: Record<string, any> = {};
    for (let cIdx = 0; cIdx < customColumns.length; cIdx++) {
      const col = customColumns[cIdx];
      const sheetColIdx = 18 + cIdx;
      const rawVal = row[sheetColIdx];
      if (rawVal !== undefined && rawVal !== '') {
        if (col.type === 'checkbox') {
          customFields[col.id] = rawVal === 'TRUE' || rawVal === 'true' || rawVal === '1';
        } else if (col.type === 'number' || col.type === 'currency') {
          customFields[col.id] = parseFloat(rawVal) || 0;
        } else {
          customFields[col.id] = rawVal;
        }
      }
    }

    tasks.push({
      id: taskId,
      projectId: currentProjectId,
      wbs,
      name,
      duration,
      startDate,
      dueDate,
      progress,
      status,
      priority,
      assignee,
      dependencies,
      isMilestone,
      level,
      parentId,
      baseline,
      notes,
      customFields,
    });
  }

  let parsedBaselineVersions = undefined;
  if (projectMeta['Baseline Versions Data']) {
    try {
      parsedBaselineVersions = JSON.parse(projectMeta['Baseline Versions Data']);
    } catch {
      // ignore parsing error
    }
  }

  const activeBaselineVersion = projectMeta['Active Baseline Version']
    ? parseInt(projectMeta['Active Baseline Version'])
    : undefined;

  const project: Partial<Project> = {
    name: projectMeta['Project Name'] || undefined,
    description: projectMeta['Description'] || undefined,
    manager: projectMeta['Manager'] || undefined,
    status: (projectMeta['Status'] as any) || undefined,
    startDate: projectMeta['Start Date'] || undefined,
    hasBaseline: projectMeta['Has Baseline'] === 'YES',
    baselineSavedAt: projectMeta['Baseline Saved At'] || undefined,
    activeBaselineVersion: Number.isFinite(activeBaselineVersion) ? activeBaselineVersion : undefined,
    baselineVersions: Array.isArray(parsedBaselineVersions) ? parsedBaselineVersions : undefined,
    lastSyncedAt: new Date().toISOString(),
  };

  return { project, tasks, customColumns };
}
