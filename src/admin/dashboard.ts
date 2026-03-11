import { AdminMetrics } from './metrics';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2,
  }).format(value);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function renderStatCard(label: string, value: string, hint: string): string {
  return `
    <article class="stat-card">
      <span class="stat-label">${escapeHtml(label)}</span>
      <strong class="stat-value">${escapeHtml(value)}</strong>
      <span class="stat-hint">${escapeHtml(hint)}</span>
    </article>
  `;
}

function renderSeries(metrics: AdminMetrics): string {
  const maxActiveUsers = Math.max(...metrics.dailySeries.map((row) => row.activeUsers), 1);
  const maxMeals = Math.max(...metrics.dailySeries.map((row) => row.meals), 1);
  const maxCost = Math.max(...metrics.dailySeries.map((row) => row.aiCostUsd), 0.001);

  return metrics.dailySeries
    .map(
      (row) => `
        <div class="series-row">
          <span class="series-label">${escapeHtml(row.label)}</span>
          <div class="series-track"><span style="width:${Math.max((row.activeUsers / maxActiveUsers) * 100, row.activeUsers > 0 ? 8 : 0)}%"></span></div>
          <span class="series-value">${escapeHtml(formatInteger(row.activeUsers))}</span>
          <div class="series-track meals"><span style="width:${Math.max((row.meals / maxMeals) * 100, row.meals > 0 ? 8 : 0)}%"></span></div>
          <span class="series-value">${escapeHtml(formatInteger(row.meals))}</span>
          <div class="series-track cost"><span style="width:${Math.max((row.aiCostUsd / maxCost) * 100, row.aiCostUsd > 0 ? 8 : 0)}%"></span></div>
          <span class="series-value">${escapeHtml(formatCurrency(row.aiCostUsd))}</span>
        </div>
      `,
    )
    .join('');
}

function renderModelRows(metrics: AdminMetrics): string {
  if (metrics.modelBreakdown.length === 0) {
    return '<tr><td colspan="4">No AI usage recorded yet.</td></tr>';
  }

  return metrics.modelBreakdown
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.model)}</td>
          <td>${escapeHtml(formatInteger(row.requests))}</td>
          <td>${escapeHtml(formatCurrency(row.costUsd))}</td>
          <td>${escapeHtml(`${formatInteger(row.inputTokens)} in / ${formatInteger(row.outputTokens)} out`)}</td>
        </tr>
      `,
    )
    .join('');
}

function renderTopUserRows(metrics: AdminMetrics): string {
  if (metrics.topUsers.length === 0) {
    return '<tr><td colspan="4">No active users in the last 30 days.</td></tr>';
  }

  return metrics.topUsers
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(formatInteger(row.inboundMessages))}</td>
          <td>${escapeHtml(formatInteger(row.meals))}</td>
          <td>${escapeHtml(formatCurrency(row.aiCostUsd))}</td>
        </tr>
      `,
    )
    .join('');
}

export function renderAdminLogin(error?: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CalTracker Admin</title>
    <style>
      :root {
        --bg: #0c1310;
        --panel: rgba(18, 29, 24, 0.88);
        --panel-border: rgba(201, 218, 131, 0.18);
        --text: #f4f1df;
        --muted: #9ba792;
        --accent: #d6ef62;
        --accent-strong: #ff7d54;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(214, 239, 98, 0.12), transparent 30%),
          radial-gradient(circle at bottom right, rgba(255, 125, 84, 0.2), transparent 35%),
          linear-gradient(140deg, #08100d 0%, #111b16 55%, #0e120f 100%);
        color: var(--text);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }

      .shell {
        width: min(92vw, 420px);
        padding: 2rem;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        backdrop-filter: blur(18px);
        border-radius: 28px;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
      }

      h1 {
        margin: 0 0 0.75rem;
        font-size: clamp(2rem, 5vw, 2.8rem);
        line-height: 0.95;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        letter-spacing: -0.04em;
      }

      p {
        margin: 0 0 1.5rem;
        color: var(--muted);
        line-height: 1.5;
      }

      label {
        display: block;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.72rem;
        color: var(--accent);
      }

      input {
        width: 100%;
        padding: 0.95rem 1rem;
        border-radius: 16px;
        border: 1px solid rgba(244, 241, 223, 0.14);
        background: rgba(5, 10, 8, 0.55);
        color: var(--text);
        font-size: 1rem;
      }

      button {
        width: 100%;
        margin-top: 1rem;
        padding: 0.95rem 1rem;
        border: none;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--accent) 0%, #f8ef96 100%);
        color: #142017;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .error {
        margin-top: 1rem;
        color: var(--accent-strong);
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <h1>Growth room.</h1>
      <p>Private operations view for CalTracker. Enter the admin password to inspect acquisition, usage, and AI spend.</p>
      <form method="post" action="/admin/login">
        <label for="password">Admin password</label>
        <input id="password" name="password" type="password" required autocomplete="current-password" />
        <button type="submit">Unlock dashboard</button>
      </form>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    </main>
  </body>
</html>`;
}

export function renderAdminDashboard(metrics: AdminMetrics): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CalTracker Admin</title>
    <style>
      :root {
        --bg: #f4f0e2;
        --ink: #16211a;
        --muted: #556053;
        --panel: rgba(255, 252, 244, 0.88);
        --panel-border: rgba(22, 33, 26, 0.08);
        --accent: #c8e04a;
        --accent-dark: #243120;
        --accent-warm: #ee7a51;
        --shadow: 0 22px 60px rgba(31, 38, 29, 0.12);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(200, 224, 74, 0.28), transparent 24%),
          radial-gradient(circle at top right, rgba(238, 122, 81, 0.18), transparent 26%),
          linear-gradient(180deg, #fbf8ef 0%, #f1ecdb 100%);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }

      .page {
        max-width: 1240px;
        margin: 0 auto;
        padding: 2rem 1.25rem 3rem;
      }

      .hero {
        display: flex;
        gap: 1rem;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5rem;
      }

      .eyebrow {
        display: inline-block;
        margin-bottom: 0.75rem;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        background: rgba(200, 224, 74, 0.28);
        color: var(--accent-dark);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.72rem;
        font-weight: 700;
      }

      h1 {
        margin: 0;
        font-size: clamp(2.6rem, 7vw, 5rem);
        line-height: 0.9;
        letter-spacing: -0.06em;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
      }

      .hero p {
        max-width: 48rem;
        margin: 0.9rem 0 0;
        color: var(--muted);
        line-height: 1.55;
      }

      .toolbar {
        display: flex;
        gap: 0.75rem;
        align-items: center;
      }

      .toolbar a,
      .toolbar button {
        appearance: none;
        border: none;
        border-radius: 999px;
        padding: 0.78rem 1rem;
        font-size: 0.84rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 700;
        cursor: pointer;
      }

      .toolbar a {
        background: var(--accent-dark);
        color: #f6f1e0;
        text-decoration: none;
      }

      .toolbar button {
        background: rgba(22, 33, 26, 0.08);
        color: var(--ink);
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.9rem;
        margin-bottom: 1rem;
      }

      .stat-card,
      .panel {
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 24px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .stat-card {
        padding: 1rem 1rem 1.1rem;
        display: grid;
        gap: 0.55rem;
      }

      .stat-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--muted);
      }

      .stat-value {
        font-size: clamp(1.5rem, 4vw, 2.15rem);
        line-height: 0.95;
      }

      .stat-hint {
        color: var(--muted);
        font-size: 0.86rem;
      }

      .layout {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: 1rem;
      }

      .panel {
        padding: 1.15rem;
      }

      .panel h2 {
        margin: 0 0 0.9rem;
        font-size: 1.05rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .series-grid {
        display: grid;
        gap: 0.55rem;
      }

      .series-head,
      .series-row {
        display: grid;
        grid-template-columns: 72px 1fr 54px 1fr 54px 1fr 84px;
        gap: 0.6rem;
        align-items: center;
      }

      .series-head {
        color: var(--muted);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .series-label,
      .series-value {
        font-size: 0.82rem;
      }

      .series-track {
        position: relative;
        height: 10px;
        border-radius: 999px;
        background: rgba(22, 33, 26, 0.08);
        overflow: hidden;
      }

      .series-track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #a0bf37 0%, #d8ec6d 100%);
      }

      .series-track.meals span {
        background: linear-gradient(90deg, #1c2d21 0%, #587557 100%);
      }

      .series-track.cost span {
        background: linear-gradient(90deg, #f3aa7d 0%, #ee7a51 100%);
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        text-align: left;
        padding: 0.78rem 0;
        border-bottom: 1px solid rgba(22, 33, 26, 0.08);
        font-size: 0.92rem;
      }

      th {
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.72rem;
      }

      .footnote {
        margin-top: 1rem;
        color: var(--muted);
        font-size: 0.84rem;
      }

      @media (max-width: 980px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .hero {
          flex-direction: column;
        }

        .toolbar {
          width: 100%;
          justify-content: space-between;
        }
      }

      @media (max-width: 760px) {
        .series-head,
        .series-row {
          grid-template-columns: 64px 1fr 46px;
        }

        .series-head span:nth-child(n + 4),
        .series-row .series-track.meals,
        .series-row .series-track.cost,
        .series-row .series-value:nth-of-type(2),
        .series-row .series-value:nth-of-type(3) {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="hero">
        <div>
          <span class="eyebrow">CalTracker Admin</span>
          <h1>Growth and cost visibility.</h1>
          <p>Operational snapshot across user growth, engagement, meal logging volume, and estimated OpenAI spend. Numbers refresh on load and are generated directly from the production database.</p>
        </div>
        <div class="toolbar">
          <a href="/admin/api/summary">JSON feed</a>
          <form method="post" action="/admin/logout">
            <button type="submit">Logout</button>
          </form>
        </div>
      </section>

      <section class="cards">
        ${renderStatCard('Total users', formatInteger(metrics.totals.totalUsers), `${formatInteger(metrics.totals.newUsers30d)} new in 30d`)}
        ${renderStatCard('Active users', formatInteger(metrics.totals.activeUsers30d), `${formatInteger(metrics.totals.activeUsers7d)} active in 7d`)}
        ${renderStatCard('Inbound messages', formatInteger(metrics.totals.inboundMessages30d), `${formatInteger(metrics.totals.inboundMessages7d)} in 7d`)}
        ${renderStatCard('Meals logged', formatInteger(metrics.totals.meals30d), `${formatInteger(metrics.totals.meals7d)} in 7d`)}
        ${renderStatCard('AI cost', formatCurrency(metrics.totals.aiCost30d), `${formatCurrency(metrics.totals.aiCostToday)} today`)}
        ${renderStatCard('Failed ops', formatInteger(metrics.totals.failedOps7d), `${formatInteger(metrics.totals.aiRequests30d)} AI calls in 30d`)}
      </section>

      <section class="layout">
        <div class="panel">
          <h2>Daily trend, last 14 days</h2>
          <div class="series-grid">
            <div class="series-head">
              <span>Day</span>
              <span>Active users</span>
              <span>Count</span>
              <span>Meals</span>
              <span>Count</span>
              <span>AI cost</span>
              <span>Spend</span>
            </div>
            ${renderSeries(metrics)}
          </div>
          <p class="footnote">Generated at ${escapeHtml(new Date(metrics.generatedAt).toLocaleString('en-US'))}. Cost is estimated from recorded model token usage, not provider invoices.</p>
        </div>

        <div class="panel">
          <h2>Top users, last 30 days</h2>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Inbound</th>
                <th>Meals</th>
                <th>AI cost</th>
              </tr>
            </thead>
            <tbody>${renderTopUserRows(metrics)}</tbody>
          </table>
        </div>
      </section>

      <section class="panel" style="margin-top: 1rem;">
        <h2>Model breakdown, last 30 days</h2>
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Calls</th>
              <th>Cost</th>
              <th>Tokens</th>
            </tr>
          </thead>
          <tbody>${renderModelRows(metrics)}</tbody>
        </table>
      </section>
    </div>
  </body>
</html>`;
}
