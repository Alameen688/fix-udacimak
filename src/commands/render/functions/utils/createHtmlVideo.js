import Handlebars from 'handlebars';
import { loadTemplate } from '../templates';
import { downloadVideo, downloadYoutube } from '../../../utils';


/**
 * Download a video atom and produce HTML for it.
 *
 * Accepts either:
 *   - the full Video object from GraphQL (preferred — gives us the Topher CDN
 *     transcodings and native subtitles for direct download), or
 *   - a bare youtube_id string (legacy callers — older lab/quiz/instruction
 *     videos that haven't been migrated yet).
 *
 * @param {object|string} videoOrYoutubeId Video object or youtube_id string
 * @param {string} outputPath directory to save the file
 * @param {string} prefix file prefix
 * @param {string} title title of atom
 */
export default async function createHtmlVideo(videoOrYoutubeId, outputPath, prefix, title) {
  let video;
  if (typeof videoOrYoutubeId === 'string') {
    if (!videoOrYoutubeId) return '';
    video = await downloadYoutube(videoOrYoutubeId, outputPath, prefix, title);
  } else if (videoOrYoutubeId && typeof videoOrYoutubeId === 'object') {
    video = await downloadVideo(videoOrYoutubeId, outputPath, prefix, title);
  } else {
    return '';
  }

  if (!video) return '';

  const html = await loadTemplate('atom.video');
  const data = { video };
  const template = Handlebars.compile(html);
  return template(data);
}
