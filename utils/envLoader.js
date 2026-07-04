const path = require("node:path");
const dotenv = require("dotenv");

function loadProjectEnv({
  cwd = process.cwd(),
  files = [".env.local", ".env"],
  override = false,
  quiet = true,
} = {}) {
  const loaded = [];

  for (const file of files) {
    const result = dotenv.config({
      path: path.join(cwd, file),
      override,
      quiet,
    });

    if (!result.error) loaded.push(file);
  }

  return loaded;
}

module.exports = {
  loadProjectEnv,
};
