import _cliProgress from 'cli-progress';
import fs from 'fs';
import ora from 'ora';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  addHttp,
  filenamify,
  logger,
} from '.';


/**
 * Download media file and save it as image assets
 * @see https://stackoverflow.com/questions/12740659/downloading-images-with-node-js
 * @param {string} uri URI of image
 * @param {string} outputDir output directory path
 * @param {function} filename optional file name parameter
 */
export default async function downloadImage(uri, outputDir, filename = undefined) {
  const errorCheck = `Please double-check the url from the JSON data to see if the link is really broken.
If it is, it could be a broken link that Udacity hasn't fixed and you can ignore this error message.
If the link was temporary broken and is up again when you check, please re-run the render to make sure the media file will be downloaded.
`;

  if (!uri) {
    return '';
  }

  // add https protocol to url if missing
  uri = addHttp(uri);

  if (!filename) {
    filename = path.basename(uri);
  }
  filename = filenamify(filename);

  const savePath = path.join(outputDir, filename);
  const tempPath = path.join(outputDir, `.${filename}`);

  // avoid re-downloading images if it already exists
  if (fs.existsSync(savePath)) {
    logger.info(`Image already exists. Skip downloading ${savePath}`);
    return filename;
  }

  // create a new progress bar instance
  const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);
  const spinner = ora(`Download media file ${filename}`).start();

  try {
    const res = await fetch(uri, {
      headers: {
        Origin: 'https://learn.udacity.com',
        Referer: 'https://learn.udacity.com/me',
        Connection: 'keep-alive',
      },
    });

    if (res.status === 500) {
      spinner.fail();
      logger.error(`Error Status 500: Request for media file fails!
The url ${uri} returns Internal Server Error.
${errorCheck}`);
      return '';
    }

    if (!res.ok || !res.body) {
      spinner.fail();
      logger.error(`HTTP ${res.status}: Failed to download ${uri}`);
      return '';
    }

    const total = Number(res.headers.get('content-length') || 0);
    if (total > 0) progressBar.start(total, 0);

    let downloaded = 0;
    const nodeStream = Readable.fromWeb(res.body);

    nodeStream.on('data', (chunk) => {
      downloaded += chunk.length;
      if (total > 0) progressBar.update(downloaded);
    });

    await pipeline(nodeStream, fs.createWriteStream(tempPath));

    spinner.succeed();
    if (total > 0) {
      progressBar.update(total);
      progressBar.stop();
    }

    await fs.promises.rename(tempPath, savePath);
    logger.info(`Downloaded media file ${filename}`);
    return filename;
  } catch (error) {
    spinner.fail();
    if (error.code && error.code === 'ENOTFOUND') {
      logger.error(`${error.code}: Request for media file fails!
The url ${uri} doesn't seem to exist.
${errorCheck}`);
      return '';
    }
    throw error;
  }
}
