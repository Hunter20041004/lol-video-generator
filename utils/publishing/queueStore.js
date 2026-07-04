const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), ".data");
const QUEUE_PATH = path.join(DATA_DIR, "publish-queue.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readQueue() {
  ensureDataDir();
  if (!fs.existsSync(QUEUE_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`[PublishQueue] Could not parse queue file: ${error.message}`);
    return [];
  }
}

function writeQueue(tasks) {
  ensureDataDir();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(tasks, null, 2), "utf8");
}

function createTaskId(platform, locale) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `pub_${Date.now()}_${locale}_${platform}_${rand}`;
}

function upsertTask(task) {
  const tasks = readQueue();
  const index = tasks.findIndex((item) => item.id === task.id);
  const nextTask = {
    ...task,
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) tasks[index] = { ...tasks[index], ...nextTask };
  else tasks.unshift({ ...nextTask, createdAt: task.createdAt || new Date().toISOString() });
  writeQueue(tasks);
  return nextTask;
}

function updateTask(id, patch) {
  const tasks = readQueue();
  const index = tasks.findIndex((item) => item.id === id);
  if (index < 0) return null;
  tasks[index] = {
    ...tasks[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeQueue(tasks);
  return tasks[index];
}

function listTasks(filter = {}) {
  const tasks = readQueue();
  return tasks.filter((task) => {
    if (filter.status && task.status !== filter.status) return false;
    if (filter.platform && task.platform !== filter.platform) return false;
    if (filter.locale && task.locale !== filter.locale) return false;
    return true;
  });
}

module.exports = {
  DATA_DIR,
  QUEUE_PATH,
  readQueue,
  writeQueue,
  createTaskId,
  upsertTask,
  updateTask,
  listTasks,
};
