import { API_ENDPOINTS_UDACITY_GRAPHQL } from '../config';
import { fetchApiUdacityGraphql } from '.';

/**
 * Fetch JSON data of a Nanodegree from Udacity API
 * @param {object} ndInfo Nanodegree information (expects key, version, locale)
 * @param {string} udacityAuthToken Udacity authentication token
 */
export default function fetchNanodegree(ndInfo, udacityAuthToken) {
  const { key, locale, version } = ndInfo;

  const query = `
    query NanodegreeQuery {
      nanodegree(key: "${key}" version: "${version}" locale: "${locale}") {
        id
        key
        title
        semantic_type
        is_public
        version
        locale
        color_scheme
        enrollment {
          product_variant
          variant
          static_access { static_access access_expiry_at }
        }
        nd_units { id }
        hero_image { url }
        forum_path
        summary
        is_graduated
        project_deadlines { due_at }
        user_state { node_key completed_at last_viewed_at unstructured }
        aggregated_state {
          node_key
          completion_amount
          completed_count
          concept_count
          last_viewed_child_key
          part_aggregated_states {
            node_key
            completed_at
            completion_amount
            completed_count
            concept_count
            last_viewed_child_key
            module_aggregated_states {
              node_key
              completed_at
              completion_amount
              completed_count
              concept_count
              last_viewed_child_key
              lesson_aggregated_states {
                node_key
                completed_at
                completed_count
                concept_count
                completion_amount
                last_viewed_child_key
              }
            }
          }
        }
        resources { files { name uri } }
        parts {
          id
          key
          title
          semantic_type
          is_public
          version
          locale
          summary
          part_type
          resources { files { name uri } }
          image { url width height }
          modules {
            id
            key
            title
            semantic_type
            is_public
            version
            locale
            is_project_module
            forum_path
            lessons {
              id
              key
              version
              locale
              semantic_type
              summary
              title
              duration
              is_public
              is_project_lesson
              display_workspace_project_only
              image { url width height }
              video { youtube_id china_cdn_id }
              lab {
                id
                key
                version
                locale
                estimated_session_duration
                duration
                is_public
                semantic_type
                title
                evaluation_objective
                partners
                overview { title summary key_takeaways video { topher_id youtube_id } }
                details { text }
                review_video { topher_id youtube_id }
                result { state skill_confidence_rating_after skill_confidence_rating_before }
                workspace {
                  id
                  key
                  title
                  semantic_type
                  is_public
                  workspace_id
                  pool_id
                  view_id
                  configuration
                }
              }
              project {
                key
                version
                locale
                duration
                semantic_type
                title
                description
                is_public
                summary
                forum_path
                rubric_id
                terminal_project_id
                resources { files { name uri } }
                image { url width height }
              }
              concepts {
                id
                key
                title
                semantic_type
                is_public
                resources { files { name uri } }
              }
            }
          }
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
