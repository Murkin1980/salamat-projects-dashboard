/**
 * Hash routing for the read-only dashboard (CP-16).
 *
 * The dashboard is a static Cloudflare Pages deployment with no backend, so the
 * route lives in the URL fragment: `#/portfolio`, `#/project/<project-id>`, `#/reports/<project-id>`. A
 * fragment route survives a direct browser navigation, a refresh and a shared
 * link without any server-side rewrite, and it keeps the browser Back button
 * working between a project card and its detail view.
 *
 * Parsing is a pure function of the hash string, so the routing contract is
 * testable without a DOM.
 */

export const DASHBOARD_VIEWS = [
  'triage',
  'portfolio',
  'experiments',
  'attention',
  'nodes',
  'reports',
  'discovery',
] as const

export type DashboardView = (typeof DASHBOARD_VIEWS)[number]

export interface DashboardRoute {
  /** Active list view. Kept even while a project is open so return navigation is explicit. */
  view: DashboardView
  /** Project opened in the detail view; `null` while a list view is active. */
  projectId: string | null
  /**
   * Project selected in History & Reports (`#/reports/<project-id>`). Present only
   * on a report route that names a project, so the selection survives a refresh,
   * a shared link and the browser Back button.
   */
  reportProjectId?: string
}

/** Project ids in the normalized contract are kebab-case (see `IdSchema`). */
const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const PROJECT_ROUTE_PREFIX = 'project/'

/** Route hash of a list view, e.g. `#/portfolio`. */
export function viewHash(view: DashboardView): string {
  return `#/${view}`
}

/** Route hash of a project's history report, e.g. `#/reports/business-discovery`. */
export function reportHash(projectId: string): string {
  return `#/reports/${projectId}`
}

/** Route hash of a project detail view, e.g. `#/project/business-discovery`. */
export function projectDetailHash(projectId: string): string {
  return `#/project/${projectId}`
}

/**
 * Parses a location hash into a dashboard route.
 *
 * Unknown or malformed routes fail safe to the default Triage view instead of
 * rendering nothing, and a well-formed but unknown project id still resolves to
 * the detail route so the view can state the gap explicitly.
 */
export function parseHashRoute(
  hash: string,
  fallbackView: DashboardView = 'triage',
): DashboardRoute {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').split('?')[0]

  if (path.startsWith(PROJECT_ROUTE_PREFIX)) {
    const projectId = path.slice(PROJECT_ROUTE_PREFIX.length).replace(/\/+$/, '')
    if (PROJECT_ID_PATTERN.test(projectId)) {
      return { view: fallbackView, projectId }
    }
  }

  const [view, reportProjectId] = path.split('/')
  if (view === 'reports' && reportProjectId && PROJECT_ID_PATTERN.test(reportProjectId)) {
    return { view: 'reports', projectId: null, reportProjectId }
  }
  if ((DASHBOARD_VIEWS as readonly string[]).includes(view)) {
    return { view: view as DashboardView, projectId: null }
  }

  return { view: 'triage', projectId: null }
}
