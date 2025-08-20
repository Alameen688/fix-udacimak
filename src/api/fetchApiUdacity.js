import { config } from '../commands/utils';
import { CLI_CONFIG_UDACITY_AUTH_TOKEN } from '../config';


/**
 * Send request to Udacity API
 * @param {string} url request url
 * @param {string} udacityAuthToken Udacity authentication token
 */
export default async function fetchApiUdacity(url, udacityAuthToken = '') {
  const token = udacityAuthToken || config.get(CLI_CONFIG_UDACITY_AUTH_TOKEN);

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    Host: 'review-api.udacity.com',
    Origin: 'https://review.udacity.com',
    Referer: 'https://review.udacity.com',
    Connection: 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36',
  };

  const res = await fetch(url, { method: 'GET', headers });
  const jsonRes = await res.json();
  if (jsonRes.errors) {
    throw jsonRes.errors;
  }
  return jsonRes;
}
