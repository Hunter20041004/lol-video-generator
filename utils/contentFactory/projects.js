const DEFAULT_CONTENT_PROJECT_ID = "lol";

const CONTENT_PROJECTS = [
  {
    id: "lol",
    name: "英雄聯盟",
    shortName: "LoL",
    domain: "game",
    sourceType: "official_patch_notes",
    sourceLabel: "官方版本公告",
    status: "active",
    description: "目前已接好的版本更新來源，負責掃描官方公告並產生可發布短影音。",
    categoryLabels: {
      SYSTEM: "系統",
      CHAMPION: "角色",
      RUNE: "機制",
      ITEM: "道具",
    },
  },
  {
    id: "generic-game",
    name: "通用遊戲更新",
    shortName: "通用",
    domain: "game",
    sourceType: "manual_update",
    sourceLabel: "手動貼上公告",
    status: "planned",
    description: "下一階段會支援貼上任何遊戲更新公告，再拆成可發布內容。",
    categoryLabels: {
      SYSTEM: "系統",
      CHAMPION: "角色",
      RUNE: "機制",
      ITEM: "道具",
    },
  },
];

const PROJECT_BY_ID = new Map(CONTENT_PROJECTS.map((project) => [project.id, project]));

function cloneProject(project) {
  return {
    ...project,
    categoryLabels: { ...(project.categoryLabels || {}) },
  };
}

function isKnownContentProjectId(projectId = "") {
  return PROJECT_BY_ID.has(String(projectId || "").trim());
}

function normalizeContentProjectId(projectId = "", fallback = DEFAULT_CONTENT_PROJECT_ID) {
  const id = String(projectId || "").trim();
  if (PROJECT_BY_ID.has(id)) return id;
  return fallback;
}

function getContentProject(projectId = DEFAULT_CONTENT_PROJECT_ID) {
  return cloneProject(PROJECT_BY_ID.get(normalizeContentProjectId(projectId)) || PROJECT_BY_ID.get(DEFAULT_CONTENT_PROJECT_ID));
}

function listContentProjects() {
  return CONTENT_PROJECTS.map(cloneProject);
}

function getCategoryLabel(category = "", projectId = DEFAULT_CONTENT_PROJECT_ID) {
  const project = getContentProject(projectId);
  return project.categoryLabels?.[category] || category || "未分類";
}

module.exports = {
  DEFAULT_CONTENT_PROJECT_ID,
  CONTENT_PROJECTS,
  getCategoryLabel,
  getContentProject,
  isKnownContentProjectId,
  listContentProjects,
  normalizeContentProjectId,
};
