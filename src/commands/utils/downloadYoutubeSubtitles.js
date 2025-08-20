// import fs from 'fs-extra';
import ora from 'ora';
// import path from 'path';
// youtube-dl was removed to avoid install-time failures.
// Subtitles download is currently not implemented without youtube-dl.
import {
  // getFileExt,
  logger,
} from '.';


/**
 * Download Youtube subtitles and rename them to be the same as Youtube video
 * file name
 * @param {string} videoId Youtube Video Id
 * @param {string} filenameYoutube Youtube filename (without extension)
 * @param {string} targetDir target directory
 */
// export default function downloadYoutubeSubtitles(videoId, filenameYoutube, targetDir) {
export default function downloadYoutubeSubtitles(videoId, filenameYoutube) {
  if (!videoId || !videoId.trim()) {
    return null;
  }

  const spinnerSubtitles = ora(`Download subtitles for ${filenameYoutube}`).start();
  spinnerSubtitles.warn();
  logger.warn('Skipping subtitles download: youtube-dl has been removed.');
  // Return an empty subtitles list to keep render flow intact
  return Promise.resolve([]);
}
