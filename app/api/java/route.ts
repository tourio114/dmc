import { javaDownloads } from '../../../lib/java';
import { catalogueResponse, errorResponse } from '../../../lib/upstream';
export async function GET(request: Request) { try { return catalogueResponse(await javaDownloads(new URL(request.url).searchParams)); } catch (e) { return errorResponse(e); } }
