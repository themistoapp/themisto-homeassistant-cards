import blackItalic from "../fonts/BlackItalic.woff2";
import medium from "../fonts/Medium.woff2";

// Safari doesn't reliably activate @font-face rules declared only inside shadow roots, so the two
// faces are registered once at document level. Both are inlined into the bundle, so there are no
// extra files to host and no CORS to configure.
export function registerFonts() {
  if (document.getElementById("themisto-card-fonts")) return;
  const style = document.createElement("style");
  style.id = "themisto-card-fonts";
  style.textContent = `
    @font-face{font-family:Themisto;src:url(${blackItalic}) format('woff2');font-weight:900;font-display:swap}
    @font-face{font-family:Themisto;src:url(${medium}) format('woff2');font-weight:400;font-display:swap}`;
  document.head.appendChild(style);
}
