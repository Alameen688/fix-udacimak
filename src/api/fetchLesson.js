import { API_ENDPOINTS_UDACITY_GRAPHQL } from '../config';
import { fetchApiUdacityGraphql } from '.';

/**
 * Fetch JSON data of a lesson from Udacity API
 * @param {object} lessonInfo id of course or Nanodegree (expects id, rootKey, locale)
 * @param {string} udacityAuthToken Udacity authentication token
 */
export default function fetchCourse(lessonInfo, udacityAuthToken) {
  const { id, rootKey } = lessonInfo;

  const query = `
    query LessonQuery {
      lesson(id: ${id}, root_key: "${rootKey}") {
        id
        key
        title
        semantic_type
        is_public
        version
        locale
        summary
        display_workspace_project_only
        resources { files { name uri } }
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
          overview {
            title summary key_takeaways
            video {
              topher_id youtube_id duration
              transcodings { uri_480p_mp4 uri_720p_mp4 uri_hls }
              subtitles { language_code url }
            }
          }
          details { text }
          review_video {
            topher_id youtube_id duration
            transcodings { uri_480p_mp4 uri_720p_mp4 uri_hls }
            subtitles { language_code url }
          }
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
        concepts {
          id
          key
          title
          semantic_type
          is_public
          user_state { node_key completed_at last_viewed_at unstructured }
          resources { files { name uri } }
          atoms {
            ...on EmbeddedFrameAtom { id key title semantic_type is_public external_uri instructor_notes }
            ...on TextAtom { id key title semantic_type is_public text instructor_notes }
            ...on TaskListAtom {
              id key title semantic_type is_public instructor_notes
              user_state { node_key completed_at last_viewed_at unstructured }
              tasks
              positive_feedback
              video_feedback {
                topher_id youtube_id china_cdn_id duration
                transcodings { uri_480p_mp4 uri_720p_mp4 uri_hls }
                subtitles { language_code url }
              }
              description
            }
            ...on ImageAtom { id key title semantic_type is_public url caption alt width height instructor_notes }
            ...on AudioSlidesAtom {
              id key title semantic_type is_public instructor_notes script
              audio { topher_id s3_url duration vtt_url }
              slides { id title content transcript voice_script start_time_seconds end_time_seconds }
            }
            ...on VideoAtom {
              id key title semantic_type is_public instructor_notes
              video {
                topher_id youtube_id china_cdn_id duration
                transcodings { uri_480p_mp4 uri_720p_mp4 uri_hls }
                subtitles { language_code url }
              }
            }
            ...on ReflectAtom {
              id key title semantic_type is_public instructor_notes
              user_state { node_key completed_at last_viewed_at unstructured }
              question { ...on TextQuestion { title semantic_type evaluation_id text } }
              answer {
                text
                video {
                  topher_id youtube_id china_cdn_id duration
                  transcodings { uri_480p_mp4 uri_720p_mp4 uri_hls }
                  subtitles { language_code url }
                }
              }
            }
            ...on RadioQuizAtom {
              id key title semantic_type is_public instructor_notes
              user_state { node_key completed_at last_viewed_at unstructured }
              question { prompt answers { id text is_correct } }
            }
            ...on CheckboxQuizAtom {
              id key title semantic_type is_public instructor_notes
              user_state { node_key completed_at last_viewed_at unstructured }
              question { prompt answers { id text is_correct } }
            }
            ...on MatchingQuizAtom {
              id key title semantic_type is_public instructor_notes
              user_state { node_key completed_at last_viewed_at unstructured }
              question {
                complex_prompt { text }
                concepts_label
                answers_label
                concepts { text correct_answer { id text } }
                answers { id text }
              }
            }
            ...on ValidatedQuizAtom {
              id key title semantic_type is_public instructor_notes
              user_state { node_key completed_at last_viewed_at unstructured }
              question { prompt matchers { ...on RegexMatcher { expression } } }
            }
            ...on QuizAtom {
              id key title semantic_type is_public instructor_notes
              user_state { node_key completed_at last_viewed_at unstructured }
              instruction {
                text
                video {
                  topher_id youtube_id china_cdn_id duration
                  transcodings { uri_480p_mp4 uri_720p_mp4 uri_hls }
                  subtitles { language_code url }
                }
              }
              question {
                ...on ImageFormQuestion {
                  title alt_text background_image semantic_type evaluation_id
                  widgets { group initial_value label marker model is_text_area tabindex placement { height width x y } }
                }
                ...on ProgrammingQuestion { title semantic_type evaluation_id initial_code_files { text name } }
                ...on CodeGradedQuestion { title prompt semantic_type evaluation_id }
                ...on IFrameQuestion { title semantic_type evaluation_id initial_code_files { text name } external_iframe_uri }
                ...on TextQuestion { title semantic_type evaluation_id text }
              }
              answer {
                text
                video {
                  topher_id youtube_id china_cdn_id duration
                  transcodings { uri_480p_mp4 uri_720p_mp4 uri_hls }
                  subtitles { language_code url }
                }
              }
            }
            ...on WorkspaceAtom {
              id key title semantic_type is_public
              workspace_id pool_id view_id gpu_capable configuration
            }
          }
        }
      }
    }
  `;

  const queryGraphql = JSON.stringify({ query, variables: null, locale: 'en-us' });
  return fetchApiUdacityGraphql(API_ENDPOINTS_UDACITY_GRAPHQL, queryGraphql, udacityAuthToken);
}
