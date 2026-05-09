import Handlebars from 'handlebars';
import fs from 'fs-extra';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { loadTemplate } from '../templates';
import {
  filenamify,
  logger,
  markdownToHtml,
} from '../../../utils';


/**
 * Stream a single audio file to disk. Returns the local relative filename
 * to embed in the HTML, or null on failure (in which case the player just
 * shows nothing — the slide content is still rendered).
 */
async function downloadAudio(url, outputPath, prefix, title) {
  if (!url) return null;
  try {
    await fs.ensureDir(outputPath);
    const ext = (path.extname(url) || '.mp3').replace(/[^.\w]/g, '') || '.mp3';
    const filename = filenamify(`${prefix}. ${title || 'audio'}${ext}`);
    const savePath = path.join(outputPath, filename);
    if (fs.existsSync(savePath)) return filename;

    const res = await fetch(url);
    if (!res.ok || !res.body) {
      logger.warn(`HTTP ${res.status} fetching audio ${url}`);
      return null;
    }
    const tempPath = path.join(outputPath, `.${filename}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tempPath));
    await fs.promises.rename(tempPath, savePath);
    return filename;
  } catch (error) {
    logger.warn(`Failed to download audio ${url}: ${error.message || error}`);
    return null;
  }
}


function formatTimestamp(start, end) {
  const fmt = (s) => {
    if (typeof s !== 'number') return null;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };
  const a = fmt(start);
  const b = fmt(end);
  if (a && b) return `${a} – ${b}`;
  if (a) return a;
  return null;
}


/**
 * Create HTML content for an AudioSlidesAtom (audio narration synced to a
 * sequence of slides). The atom carries:
 *   - audio: AudioFile { topher_id, s3_url, duration, vtt_url }
 *   - slides: [Slide { id, title, content, transcript, voice_script,
 *                      start_time_seconds, end_time_seconds }]
 *   - script: full transcript fallback
 *
 * @param {object} atom AudioSlidesAtom JSON
 * @param {string} outputPath path to save the assets folder
 * @param {string} prefix prefix for asset file names (eg. "01")
 */
export default async function createHtmlAudioSlidesAtom(atom, outputPath, prefix) {
  const audioUrl = atom.audio && (atom.audio.s3_url || atom.audio.topher_id ? `https://video.udacity-data.com/${atom.audio.topher_id}` : null);
  const audioFile = await downloadAudio(audioUrl, outputPath, prefix, atom.title);

  const slides = (atom.slides || []).map(s => ({
    title: s.title,
    timestamp: formatTimestamp(s.start_time_seconds, s.end_time_seconds),
    content: markdownToHtml(s.content || ''),
    transcript: markdownToHtml(s.transcript || ''),
  }));

  const html = await loadTemplate('atom.audioSlides');
  const template = Handlebars.compile(html);
  return template({
    audioSrc: audioFile || null,
    audioDuration: atom.audio && atom.audio.duration ? Math.round(atom.audio.duration) : null,
    slides,
    script: markdownToHtml(atom.script || ''),
  });
}
