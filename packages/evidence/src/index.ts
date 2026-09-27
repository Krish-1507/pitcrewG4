import { DatabaseSync } from 'node:sqlite';
import { realpathSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { z } from 'zod';
import {
  eventSchema,
  missionSchema,
  PitCrewError,
  repositoryGraphSchema,
  repoFactSchema,
} from '@pitcrew/protocol';
import type {
  Mission,
  MissionEvent,
  StoredEvent,
  RepositoryGraph,
  RepoFact,
} from '@pitcrew/protocol';
import { isTerminal, reduceMission } from '@pitcrew/mission-runtime';
import { redact, redactObject } from '@pitcrew/observability';

const migration1 = `
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS missions(id TEXT PRIMARY KEY, request TEXT NOT NULL, repo TEXT NOT NULL, created_at_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS mission_events(sequence INTEGER PRIMARY KEY AUTOINCREMENT, mission_id TEXT NOT NULL REFERENCES missions(id), payload_json TEXT NOT NULL, created_at_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS mission_event_order ON mission_events(mission_id, sequence);
CREATE TRIGGER IF NOT EXISTS event_no_update BEFORE UPDATE ON mission_events BEGIN SELECT RAISE(ABORT,'append-only'); END;
CREATE TRIGGER IF NOT EXISTS event_no_delete BEFORE DELETE ON mission_events BEGIN SELECT RAISE(ABORT,'append-only'); END;
CREATE TABLE IF NOT EXISTS artifacts(sha256 TEXT PRIMARY KEY, size_bytes INTEGER NOT NULL, created_at_ms INTEGER NOT NULL);
INSERT OR IGNORE INTO schema_migrations VALUES(1);
`;

const migration2 = `
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,root_path TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS repository_snapshots(root_path TEXT PRIMARY KEY, head TEXT NOT NULL, artifact TEXT NOT NULL REFERENCES artifacts(sha256), observed_at_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS repo_facts(project_root TEXT NOT NULL,id TEXT NOT NULL,fact_json TEXT NOT NULL,stale INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_root,id));
INSERT OR IGNORE INTO schema_migrations VALUES(2);
`;

const rowSchema = z.object({
  id: z.string(),
  request: z.string(),
  repo: z.string(),
});
const eventRowSchema = z.object({
  sequence: z.number(),
  payload_json: z.string(),
  created_at_ms: z.number(),
});

export class EvidenceStore {
  private constructor(
    public readonly root: string,
    private readonly db: DatabaseSync,
    private readonly secrets: readonly string[],
  ) {}
  static async open(
    root: string,
    secrets: readonly string[] = [],
  ): Promise<EvidenceStore> {
    await mkdir(join(root, 'artifacts', 'sha256'), { recursive: true });
    const db = new DatabaseSync(join(root, 'pitcrew.db'));
    db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
    );
    db.exec(migration1);
    db.exec(migration2);
    return new EvidenceStore(root, db, secrets);
  }
  create(repo: string, request: string): Mission {
    const id = 'mis_' + randomUUID();
    this.db
      .prepare('INSERT INTO missions VALUES(?,?,?,?)')
      .run(id, redact(request, this.secrets), repo, Date.now());
    return this.get(id);
  }
  get(id: string): Mission {
    const row = rowSchema.parse(
      this.db.prepare('SELECT * FROM missions WHERE id=?').get(id),
    );
    let mission: Mission = {
      ...row,
      state: 'CREATED',
      message: 'Mission created.',
      events: [],
    };
    const events: StoredEvent[] = [];
    for (const raw of this.db
      .prepare(
        'SELECT * FROM mission_events WHERE mission_id=? ORDER BY sequence',
      )
      .all(id)) {
      const item = eventRowSchema.parse(raw);
      const event = eventSchema.parse(JSON.parse(item.payload_json));
      mission = reduceMission(mission, event);
      events.push({
        sequence: item.sequence,
        missionId: id,
        timestamp: item.created_at_ms,
        event,
      });
    }
    return missionSchema.parse({ ...mission, events });
  }
  list(): Mission[] {
    return this.db
      .prepare('SELECT id FROM missions ORDER BY created_at_ms DESC')
      .all()
      .map((row) => this.get(z.object({ id: z.string() }).parse(row).id));
  }
  append(id: string, event: MissionEvent): Mission {
    const safe = eventSchema.parse(redactObject(event, this.secrets));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      reduceMission(this.get(id), safe);
      this.db
        .prepare(
          'INSERT INTO mission_events(mission_id,payload_json,created_at_ms) VALUES(?,?,?)',
        )
        .run(id, JSON.stringify(safe), Date.now());
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.get(id);
  }
  recoverInterrupted(): void {
    for (const mission of this.list())
      if (!isTerminal(mission.state))
        this.append(mission.id, {
          type: 'phase',
          state: 'NOT_PROVEN',
          message:
            'Daemon interrupted. Candidate and historical evidence retained; fresh verification required.',
        });
  }
  async artifact(body: string): Promise<string> {
    const safe = redact(body, this.secrets);
    const hash = createHash('sha256').update(safe).digest('hex');
    const dir = join(this.root, 'artifacts', 'sha256', hash.slice(0, 2));
    await mkdir(dir, { recursive: true });
    const temp = join(dir, '.' + randomUUID());
    await writeFile(temp, safe, { encoding: 'utf8', flag: 'wx' });
    await rename(temp, join(dir, hash));
    this.db
      .prepare('INSERT OR IGNORE INTO artifacts VALUES(?,?,?)')
      .run(hash, Buffer.byteLength(safe), Date.now());
    return hash;
  }
  async readArtifact(hash: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(hash))
      throw new PitCrewError('POLICY_DENIED', 'Invalid artifact identity.');
    const body = await readFile(
      join(this.root, 'artifacts', 'sha256', hash.slice(0, 2), hash),
      'utf8',
    );
    if (createHash('sha256').update(body).digest('hex') !== hash)
      throw new PitCrewError('STALE_EVIDENCE', 'Artifact integrity mismatch.');
    return body;
  }

  async saveGraph(graph: RepositoryGraph): Promise<string> {
    const safe = repositoryGraphSchema.parse(redactObject(graph, this.secrets));
    const artifact = await this.artifact(JSON.stringify(safe));
    this.db
      .prepare('INSERT OR IGNORE INTO projects VALUES(?,?,?)')
      .run('prj_' + randomUUID(), safe.root, basename(safe.root));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare('UPDATE repo_facts SET stale=1 WHERE project_root=?')
        .run(safe.root);
      for (const fact of safe.facts)
        this.db
          .prepare(
            'INSERT INTO repo_facts(project_root,id,fact_json,stale) VALUES(?,?,?,0) ON CONFLICT(project_root,id) DO UPDATE SET fact_json=excluded.fact_json,stale=0',
          )
          .run(safe.root, fact.id, JSON.stringify(fact));
      this.db
        .prepare(
          'INSERT INTO repository_snapshots VALUES(?,?,?,?) ON CONFLICT(root_path) DO UPDATE SET head=excluded.head,artifact=excluded.artifact,observed_at_ms=excluded.observed_at_ms',
        )
        .run(safe.root, safe.head, artifact, safe.observedAt);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return artifact;
  }
  async loadGraph(root: string): Promise<RepositoryGraph | undefined> {
    root = realpathSync.native(root);
    const row = this.db
      .prepare('SELECT artifact FROM repository_snapshots WHERE root_path=?')
      .get(root);
    if (!row) return undefined;
    const { artifact } = z.object({ artifact: z.string() }).parse(row);
    return repositoryGraphSchema.parse(
      JSON.parse(await this.readArtifact(artifact)),
    );
  }
  facts(root: string): RepoFact[] {
    root = realpathSync.native(root);
    return this.db
      .prepare('SELECT fact_json,stale FROM repo_facts WHERE project_root=?')
      .all(root)
      .map((raw) => {
        const row = z
          .object({ fact_json: z.string(), stale: z.number() })
          .parse(raw);
        return {
          ...repoFactSchema.parse(JSON.parse(row.fact_json)),
          stale: row.stale !== 0,
        };
      });
  }

  projects(): { id: string; root_path: string; display_name: string }[] {
    return this.db
      .prepare(
        'SELECT id,root_path,display_name FROM projects ORDER BY display_name',
      )
      .all()
      .map((row) =>
        z
          .object({
            id: z.string(),
            root_path: z.string(),
            display_name: z.string(),
          })
          .parse(row),
      );
  }
  projectRoot(id: string): string {
    return z
      .object({ root_path: z.string() })
      .parse(
        this.db.prepare('SELECT root_path FROM projects WHERE id=?').get(id),
      ).root_path;
  }

  close(): void {
    this.db.close();
  }
}
