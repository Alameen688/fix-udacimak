import Handlebars from 'handlebars';
import validUrl from 'valid-url';
import path from 'path';
import {
  downloadImage,
  makeDir,
  markdownToHtml,
} from '../../../utils';
import { loadTemplate } from '../templates';


/**
 * Create HTML content for ImageAtom.
 * (Note: `non_google_url` was removed from the schema in 2024; we only use
 * the canonical `url` field now.)
 *
 * @param {object} atom atom json
 * @param {string} outputPath path to save the assets folder for images
 * @returns {string} HTML content
 */
export default async function createHtmlImageAtom(atom, outputPath) {
  let { caption } = atom;
  const { url } = atom;
  const imageUrl = validUrl.isUri(url) ? url : null;

  // create directory for image assets
  const pathImg = makeDir(outputPath, 'img');

  // if link doesn't contain image extension, create a custom file name
  let filename;
  const extCandidate = imageUrl ? path.extname(imageUrl) : '';
  if (!extCandidate) {
    filename = `${atom.id}.gif`;
  }

  // download image first and save it
  const promiseDownload = imageUrl !== null ? downloadImage(imageUrl, pathImg, filename) : null;
  const promiseLoadTemplate = loadTemplate('atom.image');

  const [filenameImg, html] = await Promise.all([promiseDownload, promiseLoadTemplate]);
  const alt = caption;
  caption = markdownToHtml(caption);

  let file = '';
  if (filenameImg === null) {
    if (imageUrl) {
      file = imageUrl;
    }
  } else {
    file = `img/${filenameImg}`;
  }

  const dataTemplate = {
    file,
    alt,
    caption,
  };
  const template = Handlebars.compile(html);

  return template(dataTemplate);
}
