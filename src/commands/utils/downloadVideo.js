import _cliProgress from 'cli-progress';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  downloadYoutube,
  filenamify,
  findVideoLocalSubtitles,
  logger,
} from '.';


/**
 * Pick the best transcoding URL Udacity exposes for a video.
 * Order of preference: 720p mp4 → 480p mp4 → 480p_1000kbps mp4.
 * (HLS playlists are skipped — they need a transcoder to convert to a single
 * file. Topher mp4s are already a single self-contained file.)
 * @param {object} video Video object from GraphQL (Video type)
 * @returns {{url: string, quality: string} | null}
 */
function pickBestMp4(video) {
  if (!video || !video.transcodings) return null;
  const t = video.transcodings;
  if (t.uri_720p_mp4) return { url: t.uri_720p_mp4, quality: '720p' };
  if (t.uri_480p_mp4) return { url: t.uri_480p_mp4, quality: '480p' };
  if (t.uri_480p_1000kbps_mp4) return { url: t.uri_480p_1000kbps_mp4, quality: '480p (1000kbps)' };
  return null;
}


/**
 * Download a single subtitle file alongside the video.
 * Saves the file as `<filenameBase>.<lang>.<ext>`.
 * @param {{language_code: string, url: string}} subtitle
 * @param {string} filenameBase
 * @param {string} outputPath
 * @returns {Promise<{src: string, srclang: string, default: boolean} | null>}
 */
async function downloadOneSubtitle(subtitle, filenameBase, outputPath) {
  if (!subtitle || !subtitle.url) return null;
  try {
    const ext = (path.extname(subtitle.url) || '.srt').replace(/[^.\w]/g, '') || '.srt';
    const lang = (subtitle.language_code || 'en').toLowerCase();
    const filename = filenamify(`${filenameBase}.${lang}${ext}`);
    const savePath = path.join(outputPath, filename);
    if (fs.existsSync(savePath)) return { src: filename, srclang: lang, default: lang.startsWith('en') };

    const res = await fetch(subtitle.url);
    if (!res.ok || !res.body) return null;
    const nodeStream = Readable.fromWeb(res.body);
    await pipeline(nodeStream, fs.createWriteStream(savePath));
    return { src: filename, srclang: lang, default: lang.startsWith('en') };
  } catch (error) {
    logger.warn(`Failed to download subtitle ${subtitle.url}: ${error.message || error}`);
    return null;
  }
}


/**
 * Stream a video from a direct CDN URL to disk with a progress bar.
 * Mirrors the `.tempfile → rename` pattern from downloadImage so partial
 * downloads don't masquerade as completed ones if the process is interrupted.
 * @param {string} url MP4 CDN URL
 * @param {string} outputPath directory to save the file
 * @param {string} filename target file name (with extension)
 * @returns {Promise<boolean>} true on success, false on recoverable failure
 */
async function streamMp4ToDisk(url, outputPath, filename) {
  const savePath = path.join(outputPath, filename);
  const tempPath = path.join(outputPath, `.${filename}`);

  const res = await fetch(url, {
    headers: {
      // Topher CDN doesn't require auth, but a generic UA avoids any 403s
      // some CDN configurations return for empty UAs.
      'User-Agent': 'Mozilla/5.0 (compatible; udacimak/2.x)',
    },
  });

  if (!res.ok || !res.body) {
    logger.warn(`HTTP ${res.status} downloading video from ${url}`);
    return false;
  }

  const total = Number(res.headers.get('content-length') || 0);
  const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);
  if (total > 0) progressBar.start(total, 0);

  let downloaded = 0;
  const nodeStream = Readable.fromWeb(res.body);
  nodeStream.on('data', (chunk) => {
    downloaded += chunk.length;
    if (total > 0) progressBar.update(downloaded);
  });

  await pipeline(nodeStream, fs.createWriteStream(tempPath));
  if (total > 0) {
    progressBar.update(total);
    progressBar.stop();
  }

  await fs.promises.rename(tempPath, savePath);
  return true;
}


/**
 * Download a video for an atom. Prefers Udacity's own Topher CDN MP4s
 * (`Video.transcodings.uri_720p_mp4` etc.) when available, since those are
 * higher quality, don't get rate-limited like YouTube, and don't require
 * yt-dlp to be installed. Falls back to {@link downloadYoutube} (yt-dlp →
 * ytdl-core) when no transcodings are present (older content).
 *
 * @param {object} video Video object from GraphQL — expects `transcodings`,
 *   `subtitles`, `topher_id`, and `youtube_id` (any/all may be missing).
 * @param {string} outputPath directory to save the file
 * @param {string} prefix file name prefix (eg. "01")
 * @param {string} title atom title — used to build a readable file name
 * @returns {Promise<{src: string, subtitles: Array} | null>}
 */
export default async function downloadVideo(video, outputPath, prefix, title) {
  if (!video) return null;

  // Pick a stable id for the file name. Topher id is preferred since it's
  // unique across the catalog; fall back to youtube_id for legacy videos.
  const stableId = video.topher_id || video.youtube_id || 'video';
  const filenameBase = `${prefix}. ${filenamify(title || '')}-${stableId}`;
  const filename = `${filenameBase}.mp4`;
  const savePath = path.join(outputPath, filename);

  // skip if already downloaded
  if (fs.existsSync(savePath)) {
    logger.info(`Video already exists. Skip downloading ${savePath}`);
    const subtitles = findVideoLocalSubtitles(filenameBase, outputPath);
    return { src: filename, subtitles };
  }

  await fs.ensureDir(outputPath);

  // ── Path A0: HLS via yt-dlp (opt-in, when user asks for >720p) ───────────
  // The 720p mp4 endpoint Udacity exposes via GraphQL is capped at 720p, but
  // the HLS playlist (`uri_hls`) carries variants up to 1080p. Use it only
  // when the user explicitly opts in via `--quality <height>`.
  const maxHeight = global.maxVideoHeight;
  if (maxHeight && maxHeight > 720 && video.transcodings && video.transcodings.uri_hls) {
    const spinner = ora(`Downloading video (HLS, up to ${maxHeight}p, topher_id=${video.topher_id || 'n/a'})`).start();
    try {
      // eslint-disable-next-line no-use-before-define
      const ok = await downloadHlsViaYtDlp(video.transcodings.uri_hls, savePath, maxHeight);
      if (ok) {
        spinner.succeed(`Downloaded ${filename} (HLS ≤${maxHeight}p)`);

        let subtitles = [];
        if (Array.isArray(video.subtitles) && video.subtitles.length) {
          const results = await Promise.all(
            video.subtitles.map(s => downloadOneSubtitle(s, filenameBase, outputPath)),
          );
          subtitles = results.filter(Boolean);
        }
        return { src: filename, subtitles };
      }
      spinner.fail('HLS download failed; falling back to 720p mp4');
    } catch (error) {
      spinner.fail(`HLS download error: ${error.message || error}; falling back to 720p mp4`);
    }
  }

  // ── Path A: direct CDN MP4 ────────────────────────────────────────────────
  const best = pickBestMp4(video);
  if (best) {
    const spinner = ora(`Downloading video (${best.quality}, topher_id=${video.topher_id || 'n/a'})`).start();
    try {
      const ok = await streamMp4ToDisk(best.url, outputPath, filename);
      if (ok) {
        spinner.succeed(`Downloaded ${filename} (${best.quality})`);

        // Native subtitles from Udacity (SRT/VTT — already proper subtitle files)
        let subtitles = [];
        if (Array.isArray(video.subtitles) && video.subtitles.length) {
          const results = await Promise.all(
            video.subtitles.map(s => downloadOneSubtitle(s, filenameBase, outputPath)),
          );
          subtitles = results.filter(Boolean);
        }

        return { src: filename, subtitles };
      }
      // streamMp4ToDisk returned false — fall through to YouTube fallback below
      spinner.fail('CDN download failed (HTTP error); falling back to YouTube');
    } catch (error) {
      spinner.fail(`CDN download error: ${error.message || error}; falling back to YouTube`);
    }
  }

  // ── Path B: YouTube fallback (older content w/o transcodings) ────────────
  if (video.youtube_id) {
    return downloadYoutube(video.youtube_id, outputPath, prefix, title);
  }

  logger.warn(`Video has neither transcodings nor youtube_id; skipping (title=${title})`);
  return null;
}


/**
 * Download an HLS playlist (m3u8) to a single mp4 via yt-dlp, capped at
 * `maxHeight` pixels tall. Returns false if yt-dlp is missing or the download
 * fails so the caller can fall back to the progressive mp4 path.
 * @param {string} m3u8Url HLS playlist URL
 * @param {string} savePath final mp4 path to write
 * @param {number} maxHeight maximum video height (e.g. 1080)
 * @returns {Promise<boolean>}
 */
function downloadHlsViaYtDlp(m3u8Url, savePath, maxHeight) {
  return new Promise((resolve) => {
    const args = [
      '-f', `b[height<=${maxHeight}]/b`,
      '--merge-output-format', 'mp4',
      '--no-part',
      '--no-continue',
      '-o', savePath,
      m3u8Url,
    ];
    let proc;
    try {
      proc = spawn('yt-dlp', args);
    } catch (e) {
      resolve(false);
      return;
    }
    let stderr = '';
    proc.stderr.on('data', (d) => { if (global.ytVerbose) process.stderr.write(d); stderr += d.toString(); });
    proc.stdout.on('data', (d) => { if (global.ytVerbose) process.stdout.write(d); });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(savePath)) {
        resolve(true);
      } else {
        if (stderr.trim() && global.ytVerbose) logger.warn(stderr.trim());
        resolve(false);
      }
    });
  });
}
