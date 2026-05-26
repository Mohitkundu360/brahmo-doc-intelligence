import DiffMatchPatch from "diff-match-patch";

const dmp = new DiffMatchPatch();

export function getDiff(oldText: string, newText: string) {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);
  return diffs;
}