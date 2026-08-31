import { execSync } from "node:child_process";

// vercel sets these on every build. locally there is no vercel, so ask git,
// and if that fails too say so rather than printing a plausible looking sha
function sha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

export const BUILD = {
  sha: sha(),
  // resolved when the module is first loaded, which on a static page is build time
  at: new Date().toISOString(),
};
