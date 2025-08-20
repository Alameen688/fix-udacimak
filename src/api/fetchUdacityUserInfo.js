import { API_ENDPOINTS_UDACITY_GRAPHQL } from '../config';
import { fetchApiUdacityGraphql } from '.';

/**
 * Fetch User information from Udacity API
 * @param {string} udacityAuthToken Udacity authentication token
 */
export default function fetchUdacityUserInfo(udacityAuthToken) {
  const query = `
    query UserBaseQuery {
      user {
        id
        first_name
        last_name
        nickname
        nanodegrees(start_index: 0, is_graduated: false) {
          id
          key
          title
          locale
          version
          semantic_type
          user_state { last_viewed_at }
        }
        graduated_nanodegrees: nanodegrees(is_graduated: true) {
          id
          key
          locale
          version
        }
        courses(start_index: 0, is_graduated: false) {
          id
          key
          title
          locale
          version
          semantic_type
          user_state { last_viewed_at }
        }
        graduated_courses: courses(is_graduated: true) {
          id
          key
          locale
          version
        }
      }
    }
  `;

  const payload = JSON.stringify({ query, variables: null, locale: 'en-us' });
  return fetchApiUdacityGraphql(
    API_ENDPOINTS_UDACITY_GRAPHQL,
    payload,
    udacityAuthToken,
  );
}
