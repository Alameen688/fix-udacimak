#!/usr/bin/env node
/**
 * Smoke-test the new downloadVideo pipeline against one real Topher CDN video
 * pulled from a previously-downloaded nanodegree JSON.
 *
 * Usage:
 *   node scripts/smoke-test-video.js <ndJsonDir> <outDir>
 *
 * Picks the first VideoAtom that has transcodings populated and downloads it.
 */
const fs = require('fs');
const path = require('path');

const lessonJsonPath = process.argv[2];
const outDir = process.argv[3] || '/tmp/uda-smoke-video';

if (!lessonJsonPath) {
  console.error('Usage: node smoke-test-video.js <lessonDataJson> [outDir]');
  process.exit(1);
}

const { downloadVideo } = require(path.resolve(__dirname, '../lib/commands/utils'));

const lesson = JSON.parse(fs.readFileSync(lessonJsonPath, 'utf8'));
const concepts = lesson.data.lesson.concepts || [];

let firstVideoAtom = null;
for (const c of concepts) {
  for (const a of (c.atoms || [])) {
    if (a.semantic_type === 'VideoAtom' && a.video && a.video.transcodings) {
      firstVideoAtom = a;
      break;
    }
  }
  if (firstVideoAtom) break;
}

if (!firstVideoAtom) {
  console.error('No VideoAtom with transcodings found in this lesson.');
  process.exit(1);
}

console.log('Found video:', firstVideoAtom.title);
console.log('  topher_id   :', firstVideoAtom.video.topher_id);
console.log('  720p MP4    :', firstVideoAtom.video.transcodings.uri_720p_mp4);
console.log('  subtitles   :', (firstVideoAtom.video.subtitles || []).map(s => s.language_code).join(', ') || '(none)');
console.log('  → output dir:', outDir);
console.log();

fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const start = Date.now();
  const result = await downloadVideo(firstVideoAtom.video, outDir, '01', firstVideoAtom.title);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log();
  console.log('Download result:', result);
  console.log(`Elapsed: ${elapsed}s`);
  if (result && result.src) {
    const stat = fs.statSync(path.join(outDir, result.src));
    console.log(`File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  }
})().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
