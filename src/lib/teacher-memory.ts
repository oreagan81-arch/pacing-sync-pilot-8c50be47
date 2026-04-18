/**
 * THALES OS — Teacher Memory Layer
 * Captures teacher edits, derives reusable patterns, and powers the
 * Memory > Templates > AI precedence used by all generators.
 *
 * Two writes per edit:
 *   1. teacher_feedback_log — raw before/after diff (audit trail)
 *   2. teacher_memory       — extracted, scored pattern (reusable knowledge)
 *
 * Confidence math: new = old + (1 - old) * 0.3  (asymptotes toward 1.0)
 * Decay on revert: new = old * 0.7
 */
import { supabase } from '@/integrations/supabase/client';

export type EntityType =
  | 'assignment'
  | 'page'
  | 'announcement'
  | 'file'
  | 'deploy';

export type EditAction = 'edit' | 'revert' | 'deploy' | 'rename';

const CONFIDENCE_GAIN = 0.3;
const CONFIDENCE_DECAY = 0.7;

// ────────────────────────────────────────────────────────────────────────────
// 1. Raw audit log
// ────────────────────────────────────────────────────────────────────────────
export async function logEdit(
  entityType: EntityType,
  entityId: string | null,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  action: EditAction = 'edit',
): Promise<void> {
  try {
    const diff = summarizeDiff(before, after);
    await supabase.from('teacher_feedback_log').insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      before: before as never,
      after: after as never,
      diff_summary: diff,
    });
  } catch (e) {
    // Telemetry must never break flows
    console.warn('[teacher-memory] logEdit failed', e);
  }
}

function summarizeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string {
  if (!before && !after) return '';
  if (!before) return `created: ${Object.keys(after || {}).join(', ')}`;
  if (!after) return 'deleted';
  const changes: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      const bs = String(b ?? '').slice(0, 40);
      const as = String(a ?? '').slice(0, 40);
      changes.push(`${k}: "${bs}" → "${as}"`);
    }
  }
  return changes.join(' • ') || 'no field changes';
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Pattern extraction → teacher_memory
// ────────────────────────────────────────────────────────────────────────────
export async function learnFromEdit(
  entityType: EntityType,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  if (!after) return;
  try {
    const patterns = extractPatterns(entityType, before, after);
    for (const p of patterns) {
      await upsertMemory(p.category, p.key, p.value);
    }
  } catch (e) {
    console.warn('[teacher-memory] learnFromEdit failed', e);
  }
}

interface Pattern {
  category: string;
  key: string;
  value: Record<string, unknown>;
}

function extractPatterns(
  entityType: EntityType,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Pattern[] {
  if (!after) return [];
  const out: Pattern[] = [];
  const subj = String(after.subject ?? '').trim() || 'Unknown';
  const type = String(after.type ?? '').trim() || 'Default';

  if (entityType === 'assignment') {
    const title = String(after.title ?? '').trim();
    if (title) {
      out.push({
        category: 'assignment_name',
        key: `${subj}:${type}`,
        value: { titlePattern: derivePattern(title, String(after.lessonNum ?? '')) },
      });
    }
  }

  if (entityType === 'page') {
    const title = String(after.title ?? '').trim();
    const qw = String(after.qw ?? '').trim();
    if (title && qw) {
      out.push({
        category: 'page_title',
        key: `${subj}:${qw}`,
        value: { template: title },
      });
    }
    if (Array.isArray(after.sectionOrder)) {
      out.push({
        category: 'page_section_order',
        key: subj,
        value: { order: after.sectionOrder },
      });
    }
  }

  if (entityType === 'announcement') {
    const content = String(after.content ?? '');
    if (content) {
      const lines = content.split(/\n+/).filter(Boolean);
      out.push({
        category: 'announcement_phrase',
        key: `${subj}:${type}`,
        value: {
          opener: lines[0]?.slice(0, 200) ?? '',
          closer: lines[lines.length - 1]?.slice(0, 200) ?? '',
        },
      });
    }
  }

  if (entityType === 'file') {
    const friendly = String(after.friendly_name ?? '').trim();
    if (friendly) {
      out.push({
        category: 'file_naming',
        key: `${subj}:${type}`,
        value: { pattern: derivePattern(friendly, String(after.lesson_num ?? '')) },
      });
    }
  }

  if (entityType === 'deploy') {
    const day = String(after.dayOfWeek ?? '');
    const hour = Number(after.hourET ?? -1);
    if (day && hour >= 0) {
      out.push({
        category: 'deploy_timing',
        key: `${subj}:${day}`,
        value: { hourET: hour },
      });
    }
  }

  return out;
}

/**
 * Replace concrete lesson numbers with `{N}` so the pattern is reusable.
 */
function derivePattern(text: string, lessonNum: string): string {
  if (!lessonNum) return text;
  const re = new RegExp(`\\b${lessonNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  return text.replace(re, '{N}');
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Upsert + confidence scoring
// ────────────────────────────────────────────────────────────────────────────
async function upsertMemory(
  category: string,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  const { data: existing } = await supabase
    .from('teacher_memory')
    .select('id, value, confidence, usage_count')
    .eq('category', category)
    .eq('key', key)
    .maybeSingle();

  if (existing) {
    const sameValue = JSON.stringify(existing.value) === JSON.stringify(value);
    const oldConf = Number(existing.confidence ?? 0);
    const newConf = sameValue
      ? oldConf + (1 - oldConf) * CONFIDENCE_GAIN
      : Math.max(0.1, oldConf * CONFIDENCE_DECAY);
    await supabase
      .from('teacher_memory')
      .update({
        value: (sameValue ? existing.value : value) as never,
        confidence: Math.min(1, newConf),
        usage_count: (existing.usage_count ?? 0) + 1,
        last_used: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('teacher_memory').insert({
      category,
      key,
      value: value as never,
      confidence: 0.3,
      usage_count: 1,
      last_used: new Date().toISOString(),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Memory hit telemetry (lightweight localStorage counters)
// ────────────────────────────────────────────────────────────────────────────
const HITS_KEY = 'thales.memory.hits';

export function recordMemoryHit(source: 'memory' | 'template' | 'ai'): void {
  try {
    const raw = localStorage.getItem(HITS_KEY);
    const stats = raw ? JSON.parse(raw) : { memory: 0, template: 0, ai: 0 };
    stats[source] = (stats[source] ?? 0) + 1;
    localStorage.setItem(HITS_KEY, JSON.stringify(stats));
  } catch {
    /* noop */
  }
}

export function getMemoryHitStats(): { memory: number; template: number; ai: number } {
  try {
    const raw = localStorage.getItem(HITS_KEY);
    return raw ? JSON.parse(raw) : { memory: 0, template: 0, ai: 0 };
  } catch {
    return { memory: 0, template: 0, ai: 0 };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Deploy timestamp helper (called from deploy buttons)
// ────────────────────────────────────────────────────────────────────────────
export async function logDeployHabit(subject: string): Promise<void> {
  const now = new Date();
  // ET hour via Intl
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const day = et.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(et.find((p) => p.type === 'hour')?.value ?? -1);
  await logEdit('deploy', null, null, { subject, dayOfWeek: day, hourET: hour }, 'deploy');
  await learnFromEdit('deploy', null, { subject, dayOfWeek: day, hourET: hour });
}
