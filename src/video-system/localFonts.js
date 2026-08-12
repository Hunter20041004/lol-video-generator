import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";

let fontLoadPromise;

export function ensureLocalVideoFonts() {
  if (fontLoadPromise) return fontLoadPromise;

  const renderHandle = delayRender("Load repository-hosted Outfit font");
  fontLoadPromise = new FontFace(
    "Outfit",
    `url(${staticFile("fonts/Outfit-Variable.woff2")})`,
    { style: "normal", weight: "300 600" },
  )
    .load()
    .then((font) => {
      document.fonts.add(font);
      continueRender(renderHandle);
    })
    .catch((error) => {
      cancelRender(new Error(`Unable to load local Outfit font: ${error.message}`));
    });

  return fontLoadPromise;
}
