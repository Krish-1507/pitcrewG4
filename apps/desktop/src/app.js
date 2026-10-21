const view = document.querySelector('#view');
const nav = document.querySelector('#nav');

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
    '<h2>Request failed</h2><p class="notice">' +
      esc(error instanceof Error ? error.message : String(error)) +
      '</p>',
  );
}

function stateBadge(state) {
  return (
    '<span class="badge state-' + esc(state) + '">' + esc(state) + '</span>'
  );
}

function eventSummary(event) {
  switch (event.type) {
    case 'phase':
      return 'phase ' + event.state + ': ' + event.message;
    case 'evidence':
      return (
        'evidence ' +
        event.label +
        ' (exit ' +
        (event.exitCode === null ? 'n/a' : event.exitCode) +
        ')'
      );
    case 'referee':
      return 'OpenPitStop verdict ' + event.verdict + ': ' + event.message;
    case 'approval.requested':
      return 'approval requested for ' + event.action + ': ' + event.reason;
    case 'approval.resolved':
      return 'approval ' + (event.approved ? 'approved' : 'rejected');
    case 'candidate':
      return 'candidate ' + event.candidate.id + ' at ' + event.candidate.root;
    case 'candidate.eliminated':
      return 'candidate eliminated: ' + event.reason;
    case 'candidate.selected':
      return 'candidate selected: ' + event.reason;
    case 'arena.decision':
      return (
        'arena ' +
        (event.branch ? 'branched' : 'single path') +
        ': ' +
        event.reason
      );
    case 'model':
      return 'model ' + event.provider + ' calls ' + event.calls;
    case 'pause':
      return 'mission ' + event.action;
    case 'budget':
      return 'budget ' + event.kind + ': ' + event.message;
    case 'error':
      return 'error ' + event.code + ': ' + event.message;
    default:
      return event.type;
  }
}

function missionLink(mission) {
  return (
    '<a href="#/mission/' +
    esc(mission.id) +
    '"><code>' +
    esc(mission.id) +
    '</code></a> ' +
    stateBadge(mission.state) +
    '<br /><span class="muted">' +
    esc(mission.request.slice(0, 120)) +
    '</span>'
  );
}

async function home() {
  const data = await api('projects');
  render(
    '<h2>Project home</h2><p class="muted">Open a repository to index it, then read its repo story.</p>' +
      '<form id="open-form"><label>Repository path<input name="path" required /></label><button type="submit">Open project</button></form>' +
      '<h3>Projects</h3><div class="grid">' +
      (data.projects.length
        ? data.projects
            .map(
              (project) =>
                '<div class="card"><strong>' +
                esc(project.display_name) +
                '</strong><p class="mono">' +
                esc(project.root_path) +
                '</p><p><a href="#/story/' +
                esc(project.id) +
                '">Repo story</a></p></div>',
            )
            .join('')
        : '<p class="muted">No projects opened yet.</p>') +
      '</div>',
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
    '<h2>New mission</h2><p class="muted">A mission runs the configured crew, sandbox and OpenPitStop gate. One mission per repository at a time.</p>' +
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
      '</select></label><label>Request<textarea name="request" rows="5" required></textarea></label><button type="submit">Start mission</button></form>' +
      (data.projects.length
        ? ''
        : '<p class="notice">Open a project first on the Project home screen.</p>'),
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
    '<h2>Mission control</h2><p class="muted">Live daemon state only. No simulated progress.</p>' +
      (data.missions.length
        ? '<table><tr><th>Mission</th><th>State</th><th>Message</th></tr>' +
          data.missions
            .map(
              (mission) =>
                '<tr><td>' +
                missionLink(mission) +
                '</td><td>' +
                stateBadge(mission.state) +
                '</td><td>' +
                esc(mission.message) +
                '</td></tr>',
            )
            .join('') +
          '</table>'
        : '<p class="muted">No missions recorded.</p>'),
  );
}

async function mission(id) {
  const data = await api('missions/' + id);
  const mission = data.mission ?? data;
  const events = mission.events ?? [];
  const pending = events.filter(
    (item) =>
      item.event.type === 'approval.requested' &&
      !events.some(
        (other) =>
          other.event.type === 'approval.resolved' &&
          other.event.id === item.event.id,
      ),
  );
  const evidence = events.filter((item) => item.event.type === 'evidence');
  const referee = events.findLast((item) => item.event.type === 'referee');
  render(
    '<h2>Mission <code>' +
      esc(mission.id) +
      '</code> ' +
      stateBadge(mission.state) +
      '</h2><p>' +
      esc(mission.request) +
      '</p><p class="muted mono">' +
      esc(mission.repo) +
      '</p>' +
      '<div class="row"><button data-action="pause">Pause</button><button data-action="resume">Resume</button><button class="danger" data-action="cancel">Cancel</button><button data-action="certificate">Merge certificate</button></div>' +
      '<h3>Verdict</h3>' +
      (referee
        ? '<p>' +
          esc(referee.event.verdict) +
          ' — ' +
          esc(referee.event.message) +
          ' <code>' +
          esc(referee.event.digest.slice(0, 16)) +
          '</code></p>'
        : '<p class="notice">NOT_PROVEN: no independent OpenPitStop verdict is recorded.</p>') +
      '<h3>Pending approvals</h3>' +
      (pending.length
        ? pending
            .map(
              (item) =>
                '<div class="card"><strong>' +
                esc(item.event.action) +
                '</strong><p>' +
                esc(item.event.reason) +
                '</p><button data-approve="' +
                esc(item.event.id) +
                '" data-hash="' +
                esc(item.event.hash) +
                '">Approve</button> <button class="danger" data-reject="' +
                esc(item.event.id) +
                '" data-hash="' +
                esc(item.event.hash) +
                '">Reject</button></div>',
            )
            .join('')
        : '<p class="muted">No approvals are waiting.</p>') +
      '<h3>Evidence</h3>' +
      (evidence.length
        ? '<table><tr><th>Label</th><th>Artifact</th><th>Exit</th><th></th></tr>' +
          evidence
            .map(
              (item) =>
                '<tr><td>' +
                esc(item.event.label) +
                '</td><td class="mono">' +
                esc(item.event.artifact.slice(0, 16)) +
                '</td><td>' +
                esc(item.event.exitCode ?? 'n/a') +
                '</td><td><button data-artifact="' +
                esc(item.event.artifact) +
                '">Read</button></td></tr>',
            )
            .join('') +
          '</table><pre id="artifact-view" hidden></pre>'
        : '<p class="muted">No evidence artifacts recorded.</p>') +
      '<h3>Arena</h3><p><a href="#/arena/' +
      esc(mission.id) +
      '">Candidate arena and certificate</a></p>' +
      '<h3>Timeline</h3><div class="timeline">' +
      events
        .map(
          (item) =>
            '<article><span class="seq">#' +
            esc(item.sequence) +
            '</span> ' +
            esc(eventSummary(item.event)) +
            '</article>',
        )
        .join('') +
      '</div>',
  );
  view.querySelectorAll('button[data-action]').forEach((button) =>
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'certificate') {
        api('missions/' + id + '/certificate')
          .then((certificate) =>
            render(
              '<h2>Merge certificate</h2><pre>' +
                esc(JSON.stringify(certificate, null, 2)) +
                '</pre>',
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
          const pre = document.querySelector('#artifact-view');
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
    '<h2>Candidate arena</h2><p class="muted">Selection requires an exact digest match with the independent verdict.</p>' +
      '<h3>Candidates</h3><table><tr><th>Candidate</th><th>Branch</th><th>Baseline</th></tr>' +
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
      '</table>' +
      '<h3>Eliminations</h3>' +
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
        : '<p class="muted">No eliminations recorded.</p>') +
      '<h3>Selection</h3>' +
      (data.selection
        ? '<p class="mono">' +
          esc(data.selection.candidateId) +
          ' at ' +
          esc(data.selection.digest.slice(0, 16)) +
          '</p>'
        : '<p class="notice">NOT_PROVEN: no candidate has been selected.</p>') +
      '<h3>Decisions</h3>' +
      data.decisions
        .map(
          (decision) =>
            '<p>' +
            esc(decision.branch ? 'branched' : 'single path') +
            ' — ' +
            esc(decision.reason) +
            '</p>',
        )
        .join(''),
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
    '<h2>Repo story</h2><p class="muted mono">' +
      esc(data.root) +
      ' @ ' +
      esc(data.head.slice(0, 12)) +
      '</p>' +
      views
        .map((name) => {
          const items = data.items.filter((item) => item.view === name);
          if (!items.length) return '';
          return (
            '<h3>' +
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
            '</table>'
          );
        })
        .join('') +
      '<h3>Limitations</h3><p class="notice">' +
      esc(data.limitations.join(' ') || 'None recorded.') +
      '</p>',
  );
}

async function browserLab() {
  render(
    '<h2>Browser lab</h2><p class="muted">Headless or observe runs against authorized loopback targets only. Screenshots and traces are written to the daemon state directory.</p>' +
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
      '</textarea></label><button type="submit">Run scenario</button></form><pre id="browser-result" hidden></pre>',
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
    '<h2>Providers</h2><p class="muted">Credentials are stored in the operating system keychain and never rendered here.</p>' +
      '<h3>Configured routing</h3><table><tr><th>Id</th><th>Provider</th><th>Model</th></tr>' +
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
      '</table><h3>Stored credentials</h3><table><tr><th>Provider</th><th>Secret reference</th></tr>' +
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
      '</table>',
  );
}

async function approvals() {
  const data = await api('missions');
  const sections = [];
  for (const listed of data.missions) {
    const detail = await api('missions/' + listed.id);
    const mission = detail.mission ?? detail;
    const events = mission.events ?? [];
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
          esc(item.event.action) +
          '</strong><p>' +
          esc(item.event.reason) +
          '</p><p class="muted mono">mission ' +
          esc(mission.id) +
          '</p><div class="row"><button data-approve="' +
          esc(item.event.id) +
          '" data-hash="' +
          esc(item.event.hash) +
          '" data-mission="' +
          esc(mission.id) +
          '">Approve</button> <button class="danger" data-reject="' +
          esc(item.event.id) +
          '" data-hash="' +
          esc(item.event.hash) +
          '" data-mission="' +
          esc(mission.id) +
          '">Reject</button></div></div>',
      );
    }
  }
  render(
    '<h2>Approvals</h2><p class="muted">Protected actions wait for a real decision; no auto-approval path exists.</p>' +
      (sections.join('') || '<p class="muted">No approvals are waiting.</p>'),
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

window.addEventListener('hashchange', route);
route();
