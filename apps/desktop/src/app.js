const view = document.querySelector('#view');
const nav = document.querySelector('#nav');
const missionList = document.querySelector('#mission-list');
const conn = document.querySelector('#conn');

const hashParams = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
if (hashParams.get('token')) {
  sessionStorage.setItem('pitcrew.token', hashParams.get('token'));
  history.replaceState(null, '', location.pathname);
}
const token = sessionStorage.getItem('pitcrew.token');

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

async function api(path, body) {
  if (!token)
    throw new Error(
      'No session token. Open Mission Control with the URL printed by "pitcrew ui".',
    );
  const response = await fetch('/v1/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result?.error?.message ?? 'Request failed with status ' + response.status,
    );
  return result;
}

function render(html) {
  view.innerHTML = html;
}

function failure(error) {
  render(
    '<div class="thread"><h2>Request failed</h2><p class="notice">' +
      esc(error instanceof Error ? error.message : String(error)) +
      '</p></div>',
  );
}

function badge(state) {
  return (
    '<span class="badge ' +
    esc(state) +
    '"><span class="dot ' +
    esc(state) +
    '"></span>' +
    esc(state) +
    '</span>'
  );
}

const EVENT_GLYPH = {
  phase: '▸',
  evidence: '◆',
  referee: '⚖',
  'approval.requested': '⚠',
  'approval.resolved': '✓',
  candidate: '◧',
  'candidate.eliminated': '✕',
  'candidate.selected': '★',
  'arena.decision': '⑂',
  delegation: '●',
  model: '✦',
  control: '⏯',
};

function eventMessage(event) {
  switch (event.type) {
    case 'phase':
      return event.state + ' — ' + event.message;
    case 'evidence':
      return (
        event.label +
        ' (exit ' +
        (event.exitCode === null ? 'n/a' : event.exitCode) +
        ')'
      );
    case 'referee':
      return 'OpenPitStop ' + event.verdict + ' — ' + event.message;
    case 'approval.requested':
      return event.reason;
    case 'approval.resolved':
      return event.approved ? 'approved' : 'rejected';
    case 'candidate':
      return event.candidate.id + ' at ' + event.candidate.root;
    case 'candidate.eliminated':
      return 'eliminated ' + event.candidateId + ' — ' + event.reason;
    case 'candidate.selected':
      return 'selected ' + event.candidateId + ' — ' + event.reason;
    case 'arena.decision':
      return (event.branch ? 'branch' : 'single-path') + ' — ' + event.reason;
    case 'delegation':
      return event.role + ' · ' + event.status + ' · ' + event.mode;
    case 'model':
      return event.provider + ' · ' + event.calls + ' call(s)';
    case 'control':
      return event.action;
    default:
      return event.type;
  }
}

function verdictClass(state) {
  if (state === 'VERIFIED') return 'ok';
  if (state === 'BLOCKED') return 'bad';
  return 'open';
}

async function refreshSidebar(activeId) {
  try {
    const data = await api('missions');
    conn.textContent = 'daemon · connected';
    conn.className = 'conn ok';
    const missions = data.missions ?? [];
    missionList.innerHTML = missions.length
      ? missions
          .map(
            (mission) =>
              '<a class="mission-item' +
              (mission.id === activeId ? ' active' : '') +
              '" href="#/mission/' +
              esc(mission.id) +
              '"><span class="dot ' +
              esc(mission.state) +
              '"></span><span class="mi-body"><span class="mi-req">' +
              esc((mission.request ?? '').slice(0, 80)) +
              '</span><span class="mi-id">' +
              esc(mission.id) +
              ' · ' +
              esc(mission.state) +
              '</span></span></a>',
          )
          .join('')
      : '<span class="muted small">No missions yet.</span>';
  } catch {
    conn.textContent = 'daemon · offline';
    conn.className = 'conn err';
    missionList.innerHTML =
      '<span class="muted small">Cannot reach the daemon.</span>';
  }
}

async function home() {
  const data = await api('projects');
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>Project home</h2></div>' +
      '<p class="muted">Open a repository to index it, then read its repo story or start a mission.</p></div>' +
      '<form id="open-form"><label>Repository path<input name="path" required placeholder="D:\\path\\to\\repo" /></label>' +
      '<div class="row"><button type="submit" class="primary">Open project</button></div></form>' +
      '<div class="section"><h3>Projects</h3><div class="grid">' +
      (data.projects.length
        ? data.projects
            .map(
              (project) =>
                '<div class="card"><strong>' +
                esc(project.display_name) +
                '</strong><span class="mono muted">' +
                esc(project.root_path) +
                '</span><span><a href="#/story/' +
                esc(project.id) +
                '">Repo story</a></span></div>',
            )
            .join('')
        : '<p class="empty">No projects opened yet.</p>') +
      '</div></div></div>',
  );
  document.querySelector('#open-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const path = new FormData(event.target).get('path');
    api('projects/open', { path }).then(home).catch(failure);
  });
}

async function newMission() {
  const data = await api('projects');
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>New mission</h2></div>' +
      '<p class="muted">Runs the configured crew, sandbox and OpenPitStop gate. One mission per repository at a time.</p></div>' +
      '<form id="mission-form"><label>Repository<select name="repo">' +
      data.projects
        .map(
          (project) =>
            '<option value="' +
            esc(project.root_path) +
            '">' +
            esc(project.display_name) +
            '</option>',
        )
        .join('') +
      '</select></label><label>Request<textarea name="request" rows="6" required placeholder="Describe the change to make…"></textarea></label>' +
      '<div class="row"><button type="submit" class="primary">Start mission</button></div></form>' +
      (data.projects.length
        ? ''
        : '<p class="notice">Open a project first on the Project home screen.</p>') +
      '</div>',
  );
  document
    .querySelector('#mission-form')
    .addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      api('missions', {
        repo: form.get('repo'),
        request: form.get('request'),
      })
        .then((result) => {
          location.hash = '#/mission/' + result.mission_id;
        })
        .catch(failure);
    });
}

async function missions() {
  const data = await api('missions');
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>Missions</h2></div>' +
      '<p class="muted">Live daemon state only. No simulated progress.</p></div>' +
      (data.missions.length
        ? '<table><tr><th>Mission</th><th>State</th><th>Message</th></tr>' +
          data.missions
            .map(
              (mission) =>
                '<tr><td><a href="#/mission/' +
                esc(mission.id) +
                '"><code>' +
                esc(mission.id) +
                '</code></a><br /><span class="muted small">' +
                esc((mission.request ?? '').slice(0, 120)) +
                '</span></td><td>' +
                badge(mission.state) +
                '</td><td>' +
                esc(mission.message) +
                '</td></tr>',
            )
            .join('') +
          '</table>'
        : '<p class="empty">No missions recorded.</p>') +
      '</div>',
  );
}

function eventCard(item, pendingIds) {
  const event = item.event;
  const glyph = EVENT_GLYPH[event.type] ?? '·';
  let cls = 'event';
  if (event.type === 'referee')
    cls += event.verdict === 'VERIFIED' ? ' referee-ok' : ' referee-bad';
  if (event.type === 'approval.requested' && pendingIds.has(event.id))
    cls += ' approval';
  let actions = '';
  if (event.type === 'approval.requested' && pendingIds.has(event.id)) {
    actions =
      '<div class="row"><button class="primary" data-approve="' +
      esc(event.id) +
      '" data-hash="' +
      esc(event.hash) +
      '">Approve</button><button class="danger" data-reject="' +
      esc(event.id) +
      '" data-hash="' +
      esc(event.hash) +
      '">Reject</button></div>';
  }
  if (event.type === 'evidence') {
    actions =
      '<div class="row"><button data-artifact="' +
      esc(event.artifact) +
      '">Read artifact</button><span class="e-meta">' +
      esc(event.artifact.slice(0, 16)) +
      '</span></div><pre class="artifact-view" hidden></pre>';
  }
  return (
    '<article class="' +
    cls +
    '"><span class="glyph">' +
    glyph +
    '</span><div class="e-body"><span class="e-kind">' +
    esc(event.type) +
    '</span><span class="e-msg">' +
    esc(eventMessage(event)) +
    '</span><span class="e-meta">#' +
    esc(item.sequence) +
    '</span>' +
    actions +
    '</div></article>'
  );
}

async function mission(id) {
  const data = await api('missions/' + id);
  const record = data.mission ?? data;
  const events = record.events ?? [];
  const pendingIds = new Set(
    events
      .filter(
        (item) =>
          item.event.type === 'approval.requested' &&
          !events.some(
            (other) =>
              other.event.type === 'approval.resolved' &&
              other.event.id === item.event.id,
          ),
      )
      .map((item) => item.event.id),
  );
  const referee = events.findLast((item) => item.event.type === 'referee');
  const verdictState = referee ? referee.event.verdict : record.state;
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>' +
      esc(record.request) +
      '</h2>' +
      badge(record.state) +
      '</div><span class="repo">' +
      esc(record.repo) +
      ' · ' +
      esc(record.id) +
      '</span><div class="row"><button data-action="pause">Pause</button><button data-action="resume">Resume</button><button class="danger" data-action="cancel">Cancel</button><button data-action="certificate">Merge certificate</button><a href="#/arena/' +
      esc(record.id) +
      '">Arena</a></div></div>' +
      '<div class="verdict ' +
      verdictClass(verdictState) +
      '"><span class="v-state">' +
      esc(verdictState) +
      '</span><span class="muted">' +
      esc(
        referee
          ? referee.event.message
          : 'NOT_PROVEN: no independent OpenPitStop verdict is recorded.',
      ) +
      '</span>' +
      (referee
        ? '<code>' + esc(referee.event.digest.slice(0, 16)) + '</code>'
        : '') +
      '</div>' +
      '<div class="section"><h3>Thread</h3><div class="events">' +
      (events.length
        ? events.map((item) => eventCard(item, pendingIds)).join('')
        : '<p class="empty">No events recorded.</p>') +
      '</div></div></div>',
  );
  view.querySelectorAll('button[data-action]').forEach((button) =>
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'certificate') {
        api('missions/' + id + '/certificate')
          .then((certificate) =>
            render(
              '<div class="thread"><h2>Merge certificate</h2><pre>' +
                esc(JSON.stringify(certificate, null, 2)) +
                '</pre></div>',
            ),
          )
          .catch(failure);
        return;
      }
      api('missions/' + id + '/' + action, {})
        .then(() => mission(id))
        .catch(failure);
    }),
  );
  view.querySelectorAll('button[data-artifact]').forEach((button) =>
    button.addEventListener('click', () => {
      api('artifacts/' + button.dataset.artifact)
        .then((artifact) => {
          const pre = button.closest('.e-body').querySelector('.artifact-view');
          pre.hidden = false;
          pre.textContent = artifact.content;
        })
        .catch(failure);
    }),
  );
  view
    .querySelectorAll('button[data-approve], button[data-reject]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        const decision = button.dataset.approve ? 'approve' : 'reject';
        const approvalId = button.dataset.approve ?? button.dataset.reject;
        api('approvals/' + approvalId, {
          decision,
          action_hash: button.dataset.hash,
        })
          .then(() => mission(id))
          .catch(failure);
      }),
    );
}

async function arena(id) {
  const data = await api('missions/' + id + '/arena');
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>Candidate arena</h2></div>' +
      '<p class="muted">Selection requires an exact digest match with the independent verdict.</p></div>' +
      '<div class="section"><h3>Candidates</h3><table><tr><th>Candidate</th><th>Branch</th><th>Baseline</th></tr>' +
      data.candidates
        .map(
          (candidate) =>
            '<tr><td class="mono">' +
            esc(candidate.id) +
            '</td><td class="mono">' +
            esc(candidate.branch) +
            '</td><td class="mono">' +
            esc(candidate.baseline.slice(0, 12)) +
            '</td></tr>',
        )
        .join('') +
      '</table></div>' +
      '<div class="section"><h3>Eliminations</h3>' +
      (data.eliminations.length
        ? '<table><tr><th>Candidate</th><th>Reason</th></tr>' +
          data.eliminations
            .map(
              (elimination) =>
                '<tr><td class="mono">' +
                esc(elimination.candidateId) +
                '</td><td>' +
                esc(elimination.reason) +
                '</td></tr>',
            )
            .join('') +
          '</table>'
        : '<p class="empty">No eliminations recorded.</p>') +
      '</div>' +
      '<div class="section"><h3>Selection</h3>' +
      (data.selection
        ? '<p class="mono">' +
          esc(data.selection.candidateId) +
          ' at ' +
          esc(data.selection.digest.slice(0, 16)) +
          '</p>'
        : '<p class="notice">NOT_PROVEN: no candidate has been selected.</p>') +
      '</div>' +
      '<div class="section"><h3>Decisions</h3>' +
      (data.decisions.length
        ? data.decisions
            .map(
              (decision) =>
                '<p>' +
                esc(decision.branch ? 'branched' : 'single path') +
                ' — ' +
                esc(decision.reason) +
                '</p>',
            )
            .join('')
        : '<p class="empty">No decisions recorded.</p>') +
      '</div></div>',
  );
}

async function story(id) {
  const data = await api('projects/' + id + '/story');
  const views = [
    'product',
    'system',
    'request-journey',
    'change-impact',
    'trust',
  ];
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>Repo story</h2></div>' +
      '<span class="repo">' +
      esc(data.root) +
      ' @ ' +
      esc(data.head.slice(0, 12)) +
      '</span></div>' +
      views
        .map((name) => {
          const items = data.items.filter((item) => item.view === name);
          if (!items.length) return '';
          return (
            '<div class="section"><h3>' +
            esc(name) +
            '</h3><table><tr><th>Statement</th><th>Kind</th><th>Evidence</th></tr>' +
            items
              .map(
                (item) =>
                  '<tr><td>' +
                  esc(item.statement) +
                  '</td><td class="mono">' +
                  esc(item.kind) +
                  '</td><td class="mono">' +
                  esc(
                    item.evidence
                      .map((evidence) => evidence.path + ':' + evidence.line)
                      .join(', '),
                  ) +
                  '</td></tr>',
              )
              .join('') +
            '</table></div>'
          );
        })
        .join('') +
      '<div class="section"><h3>Limitations</h3><p class="notice">' +
      esc(data.limitations.join(' ') || 'None recorded.') +
      '</p></div></div>',
  );
}

async function browserLab() {
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>Browser lab</h2></div>' +
      '<p class="muted">Headless or observe runs against authorized loopback targets only. Screenshots and traces are written to the daemon state directory.</p></div>' +
      '<form id="browser-form"><label>Target URL<input name="url" value="http://127.0.0.1:4173/" required /></label><label>Mode<select name="mode"><option>headless</option><option>observe</option></select></label><label>Scenario JSON<textarea name="scenario" rows="12">' +
      esc(
        JSON.stringify(
          {
            name: 'page loads',
            url: 'http://127.0.0.1:4173/',
            steps: [{ action: 'expectVisible', target: { selector: 'body' } }],
            accessibility: true,
          },
          null,
          2,
        ),
      ) +
      '</textarea></label><div class="row"><button type="submit" class="primary">Run scenario</button></div></form><pre id="browser-result" hidden></pre></div>',
  );
  document
    .querySelector('#browser-form')
    .addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      let scenario;
      try {
        scenario = JSON.parse(form.get('scenario'));
        scenario.url = form.get('url');
      } catch (error) {
        failure(new Error('Scenario JSON is invalid: ' + error.message));
        return;
      }
      api('browser/qa', { scenario, mode: form.get('mode') })
        .then((result) => {
          const pre = document.querySelector('#browser-result');
          pre.hidden = false;
          pre.textContent = JSON.stringify(result, null, 2);
        })
        .catch(failure);
    });
}

async function providers() {
  const data = await api('providers');
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>Providers</h2></div>' +
      '<p class="muted">Credentials are stored in the operating system keychain and never rendered here.</p></div>' +
      '<div class="section"><h3>Configured routing</h3><table><tr><th>Id</th><th>Provider</th><th>Model</th></tr>' +
      data.configured
        .map(
          (provider) =>
            '<tr><td>' +
            esc(provider.id) +
            '</td><td>' +
            esc(provider.provider) +
            '</td><td class="mono">' +
            esc(provider.model ?? 'default') +
            '</td></tr>',
        )
        .join('') +
      '</table></div><div class="section"><h3>Stored credentials</h3><table><tr><th>Provider</th><th>Secret reference</th></tr>' +
      data.providers
        .map(
          (provider) =>
            '<tr><td>' +
            esc(provider.provider) +
            '</td><td class="mono">' +
            esc(provider.secret_ref ?? 'keychain') +
            '</td></tr>',
        )
        .join('') +
      '</table></div></div>',
  );
}

async function approvals() {
  const data = await api('missions');
  const sections = [];
  for (const listed of data.missions) {
    const detail = await api('missions/' + listed.id);
    const record = detail.mission ?? detail;
    const events = record.events ?? [];
    for (const item of events) {
      if (item.event.type !== 'approval.requested') continue;
      const resolved = events.find(
        (other) =>
          other.event.type === 'approval.resolved' &&
          other.event.id === item.event.id,
      );
      if (resolved) continue;
      sections.push(
        '<div class="card"><strong>' +
          esc(item.event.candidateId) +
          '</strong><p>' +
          esc(item.event.reason) +
          '</p><span class="muted mono small">mission ' +
          esc(record.id) +
          '</span><div class="row"><button class="primary" data-approve="' +
          esc(item.event.id) +
          '" data-hash="' +
          esc(item.event.hash) +
          '">Approve</button><button class="danger" data-reject="' +
          esc(item.event.id) +
          '" data-hash="' +
          esc(item.event.hash) +
          '">Reject</button></div></div>',
      );
    }
  }
  render(
    '<div class="thread"><div class="head"><div class="title-row"><h2>Approvals</h2></div>' +
      '<p class="muted">Protected actions wait for a real decision; no auto-approval path exists.</p></div>' +
      '<div class="grid">' +
      (sections.join('') || '<p class="empty">No approvals are waiting.</p>') +
      '</div></div>',
  );
  view
    .querySelectorAll('button[data-approve], button[data-reject]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        const decision = button.dataset.approve ? 'approve' : 'reject';
        const approvalId = button.dataset.approve ?? button.dataset.reject;
        api('approvals/' + approvalId, {
          decision,
          action_hash: button.dataset.hash,
        })
          .then(approvals)
          .catch(failure);
      }),
    );
}

async function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, id] = raw.split('/');
  nav
    .querySelectorAll('a')
    .forEach((link) =>
      link.classList.toggle(
        'active',
        link.getAttribute('href') === '#/' + (name || 'home'),
      ),
    );
  await refreshSidebar(name === 'mission' ? id : undefined);
  try {
    if (name === 'new') await newMission();
    else if (name === 'missions') await missions();
    else if (name === 'mission' && id) await mission(id);
    else if (name === 'arena' && id) await arena(id);
    else if (name === 'story' && id) await story(id);
    else if (name === 'story') await home();
    else if (name === 'browser') await browserLab();
    else if (name === 'providers') await providers();
    else if (name === 'approvals') await approvals();
    else await home();
  } catch (error) {
    failure(error);
  }
}

document.querySelector('#new-mission').addEventListener('click', () => {
  location.hash = '#/new';
});
window.addEventListener('hashchange', route);
route();
