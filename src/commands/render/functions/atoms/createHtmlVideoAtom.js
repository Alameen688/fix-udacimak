import {
  createHtmlVideo,
} from '../utils';


/**
 * Create HTML content for VideoAtom.
 *
 * Passes the full Video object (not just youtube_id) to the downloader so it
 * can prefer Udacity's Topher CDN transcodings (`uri_720p_mp4`) over
 * downloading from YouTube. Falls back to youtube_id when transcodings are
 * absent (older catalog content).
 *
 * @param {object} atom atom json
 * @param {string} outputPath path to save the assets folder for videos
 * @param {string} prefix prefix for file name
 * @returns {string} HTML content
 */
export default async function createHtmlVideoAtom(atom, outputPath, prefix) {
  const pathVideo = outputPath;
  // Pass the full video object — has transcodings + subtitles + youtube_id
  return createHtmlVideo(atom.video, pathVideo, prefix, atom.title);
}
