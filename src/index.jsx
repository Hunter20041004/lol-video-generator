import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
import { ensureLocalVideoFonts } from "./video-system/localFonts";

// 註冊 Remotion 的根節點
ensureLocalVideoFonts();
registerRoot(RemotionRoot);
