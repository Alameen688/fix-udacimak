import { config } from '../commands/utils';
import { CLI_CONFIG_UDACITY_AUTH_TOKEN } from '../config';


/**
 * Send request to Udacity API
 * @param {string} url request url
 * @param {string} queryGraphql graphQl Query
 * @param {string} udacityAuthToken Udacity authentication token
 */
export default async function fetchApiUdacityGraphql(url, queryGraphql, udacityAuthToken = '') {
  const token = udacityAuthToken || config.get(CLI_CONFIG_UDACITY_AUTH_TOKEN);

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=UTF-8',
    Host: 'learn.udacity.com',
    Origin: 'https://learn.udacity.com',
    Referer: 'https://learn.udacity.com/me',
    Connection: 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: queryGraphql,
  });

  const jsonRes = await res.json();
  if (jsonRes.errors) {
    throw jsonRes.errors;
  }
  return jsonRes;
}
