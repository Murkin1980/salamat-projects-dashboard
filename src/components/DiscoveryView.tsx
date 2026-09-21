import React from 'react'
import {
  IconBrandGoogle,
  IconBrandBing,
  IconClock,
  IconRobot,
  IconRoute,
  IconShieldCheck,
} from '@tabler/icons-react'
import initialSnapshotJson from '../../public/discovery-analytics.json'
import {
  parseDiscoverySnapshot,
  type DiscoverySnapshot,
} from '../discovery/discovery-analytics'
import { useDiscoverySnapshot } from '../hooks/use-discovery-analytics'

const initialSnapshot = parseDiscoverySnapshot(initialSnapshotJson)

function formatTimestamp(value: string | null) {
  if (!value) return 'Не зафиксирован'
  const date = new Date(value)
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function windowLabel(snapshot: DiscoverySnapshot) {
  return snapshot.windowHours === 168 ? 'за 7 дней' : `за ${snapshot.windowHours} ч`
}

export function DiscoveryView() {
  const { snapshot, refreshState, error } = useDiscoverySnapshot(initialSnapshot)
  const topPath = snapshot.topPaths[0]

  if (snapshot.status === 'UNAVAILABLE') {
    return (
      <section className="discovery-view" aria-labelledby="discovery-title">
        <div className="discovery-source-card discovery-unavailable">
          <IconShieldCheck size={22} />
          <div>
            <h2 id="discovery-title">Discovery data unavailable</h2>
            <p>{error ?? snapshot.message ?? 'Cloudflare analytics snapshot недоступен.'}</p>
            <small>
              Дашборд не подставляет нули как факт отсутствия ботов. Нужен успешный read-only sync Cloudflare Analytics.
            </small>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="discovery-view" aria-labelledby="discovery-title">
      <div className="discovery-kpis">
        <DiscoveryMetric
          icon={<IconBrandGoogle size={20} />}
          label="Googlebot"
          value={formatTimestamp(snapshot.lastSeen.googlebot)}
          detail="последний замеченный запрос"
        />
        <DiscoveryMetric
          icon={<IconBrandBing size={20} />}
          label="Bingbot"
          value={formatTimestamp(snapshot.lastSeen.bingbot)}
          detail="последний замеченный запрос"
        />
        <DiscoveryMetric
          icon={<IconRobot size={20} />}
          label="AI crawlers"
          value={String(snapshot.totals.aiRequests)}
          detail={windowLabel(snapshot)}
        />
        <DiscoveryMetric
          icon={<IconRoute size={20} />}
          label="Top path"
          value={topPath?.path ?? '—'}
          detail={topPath ? `${topPath.requests} запросов` : 'crawler traffic пока не зафиксирован'}
        />
      </div>

      <div className="discovery-source-card">
        <IconShieldCheck size={22} />
        <div>
          <h2 id="discovery-title">Murat House · crawler discovery</h2>
          <p>
            {snapshot.source.hostname} · Cloudflare GraphQL · окно {snapshot.windowHours} ч
            {refreshState === 'REFRESHING' ? ' · обновление…' : ''}
          </p>
          <small>{snapshot.source.qualityNote}</small>
          {snapshot.generatedAt && (
            <small className="discovery-generated">
              Snapshot: {formatTimestamp(snapshot.generatedAt)}
            </small>
          )}
        </div>
      </div>

      <div className="discovery-panels">
        <section className="discovery-panel" aria-labelledby="crawler-table-title">
          <div className="discovery-panel-head">
            <div>
              <span className="eyebrow">Кто заходил</span>
              <h2 id="crawler-table-title">Search & AI crawlers</h2>
            </div>
            <span className="discovery-window">{windowLabel(snapshot)}</span>
          </div>

          {snapshot.crawlers.length === 0 ? (
            <div className="empty-state">
              В выбранном окне известные поисковые и AI-краулеры не зафиксированы.
            </div>
          ) : (
            <div className="discovery-table-wrap">
              <table className="discovery-table">
                <thead>
                  <tr>
                    <th>Crawler</th>
                    <th>Operator</th>
                    <th>Requests</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.crawlers.map((crawler) => (
                    <tr key={crawler.id}>
                      <td>
                        <strong>{crawler.name}</strong>
                        <small>{crawler.category.replaceAll('_', ' ')}</small>
                      </td>
                      <td>{crawler.operator}</td>
                      <td>{crawler.requests}</td>
                      <td>{formatTimestamp(crawler.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="discovery-panel" aria-labelledby="top-paths-title">
          <div className="discovery-panel-head">
            <div>
              <span className="eyebrow">Что читали</span>
              <h2 id="top-paths-title">Top paths</h2>
            </div>
            <IconClock size={19} />
          </div>
          {snapshot.topPaths.length === 0 ? (
            <div className="empty-state">Пути пока не зафиксированы.</div>
          ) : (
            <ol className="discovery-path-list">
              {snapshot.topPaths.map((item) => (
                <li key={item.path}>
                  <code>{item.path}</code>
                  <strong>{item.requests}</strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </section>
  )
}

function DiscoveryMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="discovery-metric">
      <span className="discovery-metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}
