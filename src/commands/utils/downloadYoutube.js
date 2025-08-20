import _cliProgress from 'cli-progress';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import progress from 'progress-stream';
import ytdl from 'ytdl-core';
import { spawn } from 'child_process';
import {
  downloadYoutubeSubtitles,
  filenamify,
  findVideoLocalSubtitles,
  logger,
} from '.';


/**
 * Download youtube video and save locally
 * @param {string} videoId Youtube video id to construct download url
 * @param {string} outputPath directory to save the file
 * @param {string} prefix file prefix
 * @param {string} title title of atom
 * @param {string} format youtube-dl quality setting (eg. best)
 */
export default function downloadYoutube(videoId, outputPath, prefix, title) {
  return new Promise(async (resolve, reject) => {
    if (!videoId) {
      resolve(null);
      return;
    }

    const filenameBase = `${prefix}. ${filenamify(title || '')}-${videoId}`;
    const filenameYoutube = `${filenameBase}.mp4`;
    const savePath = path.join(outputPath, filenameYoutube); `${outputPath}/${filenameYoutube}`;

    // avoid re-downloading videos if it already exists
    if (fs.existsSync(savePath)) {
      logger.info(`Video already exists. Skip downloading ${savePath}`);
      const subtitles = findVideoLocalSubtitles(filenameBase, outputPath);
      resolve({
        src: filenameYoutube,
        subtitles,
      });
      return;
    }

    // Prefer yt-dlp if available
    try {
      // eslint-disable-next-line no-use-before-define
      const result = await downloadWithYtDlp(videoId, outputPath, prefix, title);
      if (result) {
        resolve(result);
        return;
      }
    } catch (e) {
      // fall back to ytdl-core
      if (global.ytVerbose) logger.warn(`yt-dlp failed, falling back to ytdl-core: ${e.message || e}`);
    }

    // start youtube download with ytdl-core fallback
    const ytVideoQualities = ['22', '18', ''];
    for (let i = 0; i < ytVideoQualities.length; i += 1) {
      try {
        // eslint-disable-next-line no-use-before-define
        const dlPromise = await downloadYoutubeHelper(videoId, outputPath, prefix, title,
          ytVideoQualities[i]);
        resolve(dlPromise);
        break;
      } catch (error) {
        if (i < ytVideoQualities.length - 1) {
          logger.error(`Failed to download youtube video with id ${videoId} with quality="${ytVideoQualities[i]}", retrying with quality="${ytVideoQualities[i + 1]}"`);
        } else {
          const { message } = error;

          if (!message) {
            reject(error);
            return;
          }

          // handle video unavailable error. See node-youtube-dl source code for
          // error message strings to check
          if (message.includes('video is unavailable')) {
            logger.error(`Youtube video with id ${videoId} is unavailable. It may have been deleted. The CLI will ignore this error and skip this download.`);
            resolve(null);
          } else if (message.includes('video has been removed by the user')) {
            logger.error(`Youtube video with id ${videoId} has been removed by the user. The CLI will ignore this error and skip this download.`);
            resolve(null);
          } else if (message.includes('sign in to view this video')) {
            logger.error(`Youtube video with id ${videoId} is private and require user to sign in to access it. The CLI will ignore this error and skip this download.`);
            resolve(null);
          } else if (message.includes('video is no longer available')) {
            logger.error(`Youtube video with id ${videoId} is no longer available. The CLI will ignore this error and skip this download.`);
            resolve(null);
          } else {
            logger.error(`Youtube video with id ${videoId} could not be downloaded available. The CLI will ignore this error and skip this download. Please check this error message:\n\n${JSON.stringify(message)}`);
            resolve(null);
          }
        }
      }
    }
  }); //.return Promise
}

function downloadYoutubeHelper(videoId, outputPath, prefix, title, format) {
  return new Promise(async (resolve, reject) => {
    const filenameBase = `${prefix}. ${filenamify(title || '')}-${videoId}`;
    const filenameYoutube = `${filenameBase}.mp4`;
    const urlYoutube = `https://www.youtube.com/watch?v=${videoId}`;
    const tempPath = path.join(outputPath, `.${filenameYoutube}`);
    const savePath = path.join(outputPath, filenameYoutube); `${outputPath}/${filenameYoutube}`;
    let timeGap;
    let timeout = 0;

    // select target itag (e.g., 22 = 720p mp4, 18 = 360p mp4),
    // fallback to highest progressive audio+video
    const targetItag = format && `${format}`.trim() ? `${format}`.trim() : null;

    // calculate amount of time to wait before starting this next Youtube download
    if (global.previousYoutubeTimestamp) {
      // time difference between last Youtube download and this one
      timeGap = Date.now() - global.previousYoutubeTimestamp;
      const delayYoutube = global.delayYoutube * 1000;

      if (timeGap > 0 && timeGap <= delayYoutube) {
        timeout = delayYoutube - timeGap;
      } else {
        timeout = 0;
      }
    }

    // delay to avoid Youtube from detecting youtube-dl usage
    await new Promise((resolveWait) => {
      const timeoutSeconds = parseFloat(timeout / 1000).toFixed(1);
      const spinnerDelayYoutube = ora(`Delaying Youtube download for further ${timeoutSeconds} seconds`).start();
      setTimeout(() => {
        spinnerDelayYoutube.stop();
        resolveWait();
      }, timeout);
    });

    const spinnerInfo = ora(`Getting Youtube video (id=${videoId}) information with quality="${format}"`).start();
    const requestHeaders = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
    };
    const video = ytdl(urlYoutube, {
      quality: targetItag || 'highest',
      filter: 'audioandvideo',
      requestOptions: { headers: requestHeaders },
      highWaterMark: 2 ** 25,
      dlChunkSize: 0,
    });

    video.on('info', (info, chosenFormat) => {
      spinnerInfo.succeed();
      // get video name
      const fileSize = parseInt((chosenFormat && chosenFormat.contentLength) || 0, 10) || 0;
      // create a new progress bar instance
      const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);
      if (fileSize > 0) {
        progressBar.start(fileSize, 0);
      }


      const progressStream = progress({
        length: fileSize || undefined,
        time: 20,
      });
      if (fileSize > 0) {
        progressStream.on('progress', (progressData) => {
          progressBar.update(progressData.transferred);
        });
      }

      // Write video to temporary file first. If download finishes, rename it
      // to proper file name later. This is to avoid the issue when the terminal
      // stop unexpectedly, when restart, the unfinished video will be
      // redownloaded
      video
        .pipe(progressStream)
        .pipe(fs.createWriteStream(tempPath));

      video.on('end', async () => {
        // rename temp file to final file name
        try {
          await fs.rename(tempPath, savePath);
        } catch (errorRename) {
          reject(errorRename);
        }

        if (fileSize > 0) {
          progressBar.update(fileSize);
          progressBar.stop();
        }
        logger.info(`Downloaded video ${filenameYoutube} with quality="${format}"`);

        let subtitles = [];

        if (global.downloadYoutubeSubtitles) {
          try {
            subtitles = await downloadYoutubeSubtitles(videoId, filenameBase, outputPath);
          } catch (error) {
            logger.warn(error);
          }
        } //.if downloadYoutubeSubtitles

        global.previousYoutubeTimestamp = Date.now();
        resolve({
          src: filenameYoutube,
          subtitles,
        });
      }); //.video.on end
    }); //.video.on info

    video.on('error', async (error) => {
      spinnerInfo.fail();
      reject(error);
    });
  });
}

function hasYtDlp() {
  try {
    const proc = spawn('yt-dlp', ['--version']);
    return new Promise((resolve) => {
      proc.on('error', () => resolve(false));
      proc.on('close', code => resolve(code === 0));
    });
  } catch (e) {
    return Promise.resolve(false);
  }
}

async function downloadWithYtDlp(videoId, outputPath, prefix, title) {
  const available = await hasYtDlp();
  if (!available) return null;

  const filenameBase = `${prefix}. ${filenamify(title || '')}-${videoId}`;
  const filenameYoutube = `${filenameBase}.mp4`;
  // tempPath not needed with yt-dlp; kept here for parity with ytdl-core approach
  const savePath = path.join(outputPath, filenameYoutube);

  // avoid re-downloading videos if it already exists
  if (fs.existsSync(savePath)) {
    const subtitles = findVideoLocalSubtitles(filenameBase, outputPath);
    return { src: filenameYoutube, subtitles };
  }

  // Respect global delay between downloads
  let timeGap;
  let timeout = 0;
  if (global.previousYoutubeTimestamp) {
    timeGap = Date.now() - global.previousYoutubeTimestamp;
    const delayYoutube = global.delayYoutube * 1000;
    timeout = timeGap > 0 && timeGap <= delayYoutube ? delayYoutube - timeGap : 0;
  }
  if (timeout > 0) {
    const spinnerDelay = ora(`Delaying Youtube download for further ${(timeout / 1000).toFixed(1)} seconds`).start();
    await new Promise(r => setTimeout(() => { spinnerDelay.stop(); r(); }, timeout));
  }

  const spinner = ora(`Downloading Youtube via yt-dlp (id=${videoId})`).start();
  await fs.ensureDir(outputPath);

  const urlYoutube = `https://www.youtube.com/watch?v=${videoId}`;
  // Prefer mp4 progressive or merge to mp4
  const format = 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv+ba/b';
  const args = [
    '-f', format,
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--no-continue',
    '--no-part',
    '-o', path.join(outputPath, `${filenameBase}.%(ext)s`),
    urlYoutube,
  ];

  // Subtitles support
  if (global.downloadYoutubeSubtitles) {
    args.unshift('--convert-subs', 'vtt');
    args.unshift('--sub-format', 'vtt');
    args.unshift('--write-auto-sub');
    args.unshift('--write-sub');
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { if (global.ytVerbose) process.stderr.write(d); stderr += d.toString(); });
    proc.stdout.on('data', (d) => { if (global.ytVerbose) process.stdout.write(d); });
    proc.on('error', (err) => { spinner.fail(); reject(err); });
    proc.on('close', async (code) => {
      if (code !== 0) {
        spinner.fail();
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
        return;
      }
      try {
        // yt-dlp writes directly to final file name (mp4)
        if (!fs.existsSync(savePath)) {
          // Some formats might have yielded mkv. Try to locate any output matching base name.
          const entries = await fs.readdir(outputPath);
          const match = entries.find(n => n.startsWith(`${filenameBase}.`));
          if (match) await fs.rename(path.join(outputPath, match), savePath);
        }
        spinner.succeed();
        let subtitles = [];
        if (global.downloadYoutubeSubtitles) {
          try {
            subtitles = findVideoLocalSubtitles(filenameBase, outputPath);
          } catch (e) { /* ignore */ }
        }
        global.previousYoutubeTimestamp = Date.now();
        resolve({ src: filenameYoutube, subtitles });
      } catch (e) {
        spinner.fail();
        reject(e);
      }
    });
  });
}
