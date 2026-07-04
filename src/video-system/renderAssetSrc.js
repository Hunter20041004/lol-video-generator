import { staticFile } from "remotion";

const LOCAL_RENDER_ASSET_PATTERN = /^\/?render-assets\//;
const DIRECT_ASSET_PATTERN = /^(https?:|data:|blob:)/i;

export const resolveRenderAssetSrc = (src = "") => {
  if (!src) return "";

  const value = String(src);
  if (DIRECT_ASSET_PATTERN.test(value)) return value;

  if (LOCAL_RENDER_ASSET_PATTERN.test(value)) {
    return staticFile(value.replace(/^\/+/, ""));
  }

  return value;
};
