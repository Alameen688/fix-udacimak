import getPkgInfo from './getPkgInfo';
import { API_ENDPOINTS_NPMS_PACKAGE } from '../../config';


/**
 * Fetch the latest information of the package from npm registry
 */
export default async function fetchPackageInfo() {
  const appName = getPkgInfo().name;

  const url = `${API_ENDPOINTS_NPMS_PACKAGE}/${appName}`;

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 5 * 1000);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(to);
    const jsonRes = await res.json();
    return jsonRes.collected?.metadata;
  } catch (error) {
    clearTimeout(to);
    throw error;
  }
}
