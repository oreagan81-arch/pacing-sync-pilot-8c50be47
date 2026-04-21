/**
 * THALES OS — Canvas HTML Generator
 * Premium mobile-friendly Canvas Agenda Pages.
 * Uses Canvas RCE-compatible classes and inline styles.
 */

import { applyBrevity } from './assignment-logic';
import { injectFileLinks, injectAssignmentLink, type ContentMapEntry } from './auto-link';
import { parseResources, type Resource } from '@/types/thales';

// Subject-specific student book mappings for 25-26 template (always included in resources)
const STUDENT_BOOKS: Record<string, string> = {
  Math: 'Math Student Book',
  Reading: 'Reading Book',
  Spelling: 'Spelling Book',
  'Language Arts': 'Language Arts Student Book',
  History: 'History Textbook',
  Science: 'Science Textbook',
};

export interface RedirectPageParams {
  thisSubject: 'History' | 'Science';
  activeSubject: 'History' | 'Science';
  weekNum: number;
  quarter: string;
  dateRange: string;
  quarterColor: string;
}

/**
 * Redirect-only Canvas page used when one of History/Science is the
 * "active" subject for the week — the other subject's page tells students
 * to visit the active course instead.
 */
export function generateRedirectPageHtml(params: RedirectPageParams): string {
  const { thisSubject, activeSubject, weekNum, quarter, dateRange, quarterColor } = params;
  const courseId = COURSE_IDS[activeSubject];
  const courseUrl = `https://thalesacademy.instructure.com/courses/${courseId}`;
  return `<div id="kl_wrapper_3" class="kl_circle_left kl_wrapper" style="border-style: none;">
    <div id="kl_banner" class="">
        <h2 class="" style="color: #ffffff; background-color: ${quarterColor}; text-align: center;"><span id="kl_banner_right" class="" style="color: #ffffff; background-color: ${quarterColor};">${thisSubject} \u2014 Weekly Agenda</span></h2>
        <p class="kl_subtitle">${quarter}, Week ${weekNum} | ${dateRange}</p>
    </div>
    <div id="kl_custom_block_0" class="">
        <h3 style="background-color: ${quarterColor}; color: #ffffff; border-color: ${quarterColor};"><i class="fas fa-info" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>This Week</h3>
        <p style="line-height: 1.6;">We are currently in <strong>${activeSubject}</strong>.</p>
        <p style="line-height: 1.6;">Please visit the <a href="${courseUrl}" target="_blank">${activeSubject} Canvas course</a> for this week's agenda.</p>
        <p>&nbsp;</p>
    </div>
</div>`;
}

export interface CanvasPageRow {
  day: string;
  type: string | null;
  lesson_num: string | null;
  in_class: string | null;
  at_home: string | null;
  canvas_url: string | null;
  canvas_assignment_id: string | null;
  object_id: string | null;
  subject: string;
  resources: string | null;
}

export interface CanvasPageParams {
  subject: string;
  rows: CanvasPageRow[];
  quarter: string;
  weekNum: number;
  dateRange: string;
  reminders: string;
  resources: string;
  quarterColor: string;
  contentMap?: ContentMapEntry[];
}

export interface HomeroomPageParams {
  weekNum: number;
  quarter: string;
  dateRange: string;
  quarterColor: string;
  reminders: string;
  resources: string;
  homeroomNotes?: string;
  birthdays?: string;
  upcomingTests?: string[];
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const BLOCK_IDS: Record<string, string> = {
  Monday: 'kl_custom_block_3',
  Tuesday: 'kl_custom_block_4',
  Wednesday: 'kl_custom_block_6',
  Thursday: 'kl_custom_block_2',
  Friday: 'kl_custom_block_1',
};

// Mobile-friendly H4 divider style — replaces fixed width: 60%
const DIVIDER_STYLE = (color: string) =>
  `color: #ffffff; background-color: #333333; padding: 6px 16px; border-left: 4px solid ${color}; border-width: 0 0 0 4px; max-width: 100%; width: auto; display: inline-block;`;

const DAY_HEADER_STYLE = (color: string) =>
  `background-color: ${color}; color: #ffffff; border-color: ${color};`;

// Darken a hex color by a given percent (0-100). Used for banner gradients.
function darkenHex(hex: string, pct: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const amt = Math.round(2.55 * pct);
  const r = Math.max(0, ((num >> 16) & 0xff) - amt);
  const g = Math.max(0, ((num >> 8) & 0xff) - amt);
  const b = Math.max(0, (num & 0xff) - amt);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Banner inline style: solid fallback first (for older RCEs), then gradient layered via background shorthand.
const BANNER_BG_STYLE = (color: string) =>
  `color: #ffffff; background-color: ${color}; background: linear-gradient(135deg, ${color} 0%, ${darkenHex(color, 15)} 100%); text-align: center;`;

function formatLastUpdated(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Resource → <a> or text.
function renderResource(r: Resource): string {
  const label = r.label.trim();
  if (!label) return '';
  if (r.url) {
    return `        <li style="line-height: 1.5;"><a href="${r.url}" target="_blank">${label}</a></li>`;
  }
  return `        <li style="line-height: 1.5;">${label}</li>`;
}

export function generateCanvasPageHtml(params: CanvasPageParams): string {
  const { subject, rows, quarter, weekNum, dateRange, reminders, resources, quarterColor, contentMap = [] } = params;
  const parts: string[] = [];

  // 1. BANNER
  parts.push(`<div id="kl_wrapper_3" class="kl_circle_left kl_wrapper" style="border-style: none;">
    <div id="kl_banner" class="">
        <h2 class="" style="${BANNER_BG_STYLE(quarterColor)}"><span id="kl_banner_right" class="" style="color: #ffffff; background-color: ${quarterColor};">${subject} \u2014 Weekly Agenda</span></h2>
        <p class="kl_subtitle">${quarter}, Week ${weekNum} | ${dateRange}</p>
        <p class="kl_subtitle" style="color: #888888; font-size: 0.85em; margin-top: -4px;"><em>Last updated: ${formatLastUpdated()}</em></p>
    </div>`);

  // 2. REMINDERS (always show with enhanced content for 25-26 template)
  // Collect lessons and tests from this week
  const lessons = rows
    .filter(r => r.lesson_num && r.lesson_num.trim())
    .map(r => r.lesson_num)
    .filter((v, i, a) => a.indexOf(v) === i); // unique
  const hasTests = rows.some(r => r.type === 'Test' || (r.in_class || '').toLowerCase().includes('test'));
  
  let reminderItems = '';
  if (reminders && reminders.trim()) {
    // Use custom reminders if provided
    reminderItems = reminders.split('\n').filter(Boolean).map(
      (r) => `        <p style="line-height: 1.5;">${r.trim()}</p>`
    ).join('\n');
  } else if (lessons.length > 0 && !hasTests) {
    // Auto-generate reminder with current lesson info when no tests
    const lessonList = lessons.join(', ');
    reminderItems = `        <p style="line-height: 1.5;"><strong>This week we're studying:</strong> ${lessonList}</p>\n        <p style="line-height: 1.5;">Check Canvas daily for updates and assignments.</p>`;
  } else if (hasTests) {
    // If there are tests, remind about upcoming ones
    reminderItems = `        <p style="line-height: 1.5;"><strong>Test scheduled this week!</strong> Come prepared and review all materials.</p>\n        <p style="line-height: 1.5;">Check Canvas for upcoming test dates next week.</p>`;
  } else {
    reminderItems = `        <p style="line-height: 1.5;">Check Canvas daily for updates and announcements.</p>`;
  }
  
  parts.push(`    <div id="kl_custom_block_0" class="">
        <h3 class="" style="background-color: #c51062; color: #ffffff; border-color: #c51062;"><i class="fas fa-exclamation" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>Reminders</h3>
${reminderItems}
        <p>&nbsp;</p>
    </div>`);

  // 3. RESOURCES — always show with student book for 25-26 template
  const allResources: Resource[] = [];
  
  // Always add subject's student book first
  const studentBook = STUDENT_BOOKS[subject];
  if (studentBook) {
    allResources.push({ label: studentBook });
  }
  
  // Add aggregated resources from per-day rows + week metadata
  for (const row of rows) {
    if (row.resources && row.resources.trim()) {
      const parsed = parseResources(row.resources);
      for (const r of parsed) {
        // Avoid duplicates by label
        if (!allResources.some(existing => existing.label === r.label)) {
          allResources.push(r);
        }
      }
    }
  }
  // Legacy week-level resources (if any, treat as single entries)
  if (resources && resources.trim()) {
    resources.split('\n').filter(Boolean).forEach((r) => {
      const trimmed = r.trim();
      if (!allResources.some(existing => existing.label === trimmed)) {
        allResources.push({ label: trimmed });
      }
    });
  }

  // Always show resources section (guaranteed to have student book)
  const resourceItems = allResources.length > 0 ? `<ul>\n${allResources.map(renderResource).filter(Boolean).join('\n')}\n        </ul>` : '';
  parts.push(`    <div id="kl_custom_block_5" class="">
        <h3 style="background-color: #00c0a5; color: #ffffff; border-color: #00c0a5;"><i class="fas fa-question" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>Resources</h3>
${resourceItems}
        <p>&nbsp;</p>
    </div>`);

  // 4. DAILY BLOCKS
  for (const day of DAYS_ORDER) {
    const dayRows = rows.filter((r) => r.day === day);
    if (dayRows.length === 0) continue;

    const blockId = BLOCK_IDS[day];
    const row = dayRows[0];

    // No Class / No School
    if (row.type === 'X' || row.type === 'No Class' || row.type === '-') {
      const label = row.type === 'X' ? 'No School' : 'No Class';
      parts.push(`    <div id="${blockId}" class="">
        <h3 class="" style="${DAY_HEADER_STYLE(quarterColor)}"><i class="fas fa-school" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>${day}</h3>
        <p style="line-height: 1.5;"><em>${label}</em></p>
        <p>&nbsp;</p>
    </div>`);
      continue;
    }

    // Build In Class content with auto-linked refs and assignment hyperlink.
    // Empty in_class → muted "Lesson plan TBD" placeholder so the page never has a blank paragraph.
    const rawInClass = (row.in_class || '').trim();
    let brevityText: string;
    if (!rawInClass) {
      brevityText = '<em style="color: #888;">Lesson plan TBD</em>';
    } else {
      brevityText = applyBrevity(row.subject, row.lesson_num, rawInClass);
      brevityText = injectFileLinks(brevityText, contentMap, row.subject);
      brevityText = injectAssignmentLink(brevityText, row.canvas_url);
    }

    // For multiple subjects on the same day (Reading tab merges Reading + Spelling)
    const extraRows = dayRows.slice(1);
    const extraInClass = extraRows
      .map((r) => {
        const raw = (r.in_class || '').trim();
        if (!raw) return `        <p style="line-height: 1.5;"><em style="color: #888;">Lesson plan TBD</em></p>`;
        let t = applyBrevity(r.subject, r.lesson_num, raw);
        t = injectFileLinks(t, contentMap, r.subject);
        t = injectAssignmentLink(t, r.canvas_url);
        return `        <p style="line-height: 1.5;">${t}</p>`;
      })
      .join('\n');

    const isFriday = day === 'Friday';
    // Friday Rule #1: No At Home section on Friday pages — hard block
    const hasAtHome = !isFriday && row.at_home && row.at_home.trim();

    let dayHtml = `    <div id="${blockId}" class="">
        <h3 class="" style="${DAY_HEADER_STYLE(quarterColor)}"><i class="fas fa-school" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>${day}</h3>
        <h4 class="kl_solid_border" style="${DIVIDER_STYLE(quarterColor)}"><strong>In Class</strong></h4>
        <p style="line-height: 1.5;">${brevityText}</p>`;

    if (extraInClass) {
      dayHtml += `\n${extraInClass}`;
    }

    // AT HOME — only if there's homework and it's not Friday
    if (hasAtHome) {
      let atHomeText = (row.at_home || '').trim();
      atHomeText = injectFileLinks(atHomeText, contentMap, row.subject);
      dayHtml += `
        <p>&nbsp;</p>
        <h4 class="kl_solid_border" style="${DIVIDER_STYLE(quarterColor)}"><strong>At Home</strong></h4>
        <p style="line-height: 1.5;">${atHomeText}</p>`;
    }

    // Extra rows at-home (e.g. Spelling homework on Reading tab)
    for (const er of extraRows) {
      if (!isFriday && er.at_home && er.at_home.trim()) {
        if (!hasAtHome) {
          dayHtml += `
        <p>&nbsp;</p>
        <h4 class="kl_solid_border" style="${DIVIDER_STYLE(quarterColor)}"><strong>At Home</strong></h4>`;
        }
        const linked = injectFileLinks(er.at_home.trim(), contentMap, er.subject);
        dayHtml += `
        <p style="line-height: 1.5;">${linked}</p>`;
      }
    }

    // Friday explicit no-homework note
    if (isFriday) {
      dayHtml += `
        <p>&nbsp;</p>
        <p style="line-height: 1.5;"><em>No homework over the weekend \u2014 enjoy! \ud83c\udf89</em></p>`;
    }

    dayHtml += `
        <p>&nbsp;</p>
    </div>`;

    parts.push(dayHtml);
  }

  // Close wrapper
  parts.push(`</div>`);

  return parts.join('\n');
}

/**
 * Homeroom variant — no daily lesson blocks. Banner + reminders + notes + birthdays + tests + resources.
 */
export function generateHomeroomPageHtml(params: HomeroomPageParams): string {
  const { weekNum, quarter, dateRange, quarterColor, reminders, resources, homeroomNotes, birthdays, upcomingTests } = params;
  const parts: string[] = [];

  parts.push(`<div id="kl_wrapper_3" class="kl_circle_left kl_wrapper" style="border-style: none;">
    <div id="kl_banner" class="">
        <h2 class="" style="${BANNER_BG_STYLE(quarterColor)}"><span id="kl_banner_right" class="" style="color: #ffffff; background-color: ${quarterColor};">Homeroom \u2014 Weekly Update</span></h2>
        <p class="kl_subtitle">${quarter}, Week ${weekNum} | ${dateRange}</p>
        <p class="kl_subtitle" style="color: #888888; font-size: 0.85em; margin-top: -4px;"><em>Last updated: ${formatLastUpdated()}</em></p>
    </div>`);

  // Notes from teacher
  if (homeroomNotes && homeroomNotes.trim()) {
    const noteHtml = homeroomNotes
      .split('\n')
      .filter(Boolean)
      .map((n) => `        <p style="line-height: 1.6;">${n.trim()}</p>`)
      .join('\n');
    parts.push(`    <div id="kl_custom_block_7" class="">
        <h3 style="background-color: ${quarterColor}; color: #ffffff; border-color: ${quarterColor};"><i class="fas fa-comment" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>From Mr. Teacher</h3>
${noteHtml}
        <p>&nbsp;</p>
    </div>`);
  }

  // Reminders
  if (reminders && reminders.trim()) {
    const items = reminders.split('\n').filter(Boolean).map(
      (r) => `        <p style="line-height: 1.5;">${r.trim()}</p>`
    ).join('\n');
    parts.push(`    <div id="kl_custom_block_0" class="">
        <h3 style="background-color: #c51062; color: #ffffff; border-color: #c51062;"><i class="fas fa-exclamation" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>Reminders</h3>
${items}
        <p>&nbsp;</p>
    </div>`);
  }

  // Upcoming tests
  if (upcomingTests && upcomingTests.length > 0) {
    const items = upcomingTests.map((t) => `        <p style="line-height: 1.5;">${t}</p>`).join('\n');
    parts.push(`    <div id="kl_custom_block_8" class="">
        <h3 style="background-color: #c87800; color: #ffffff; border-color: #c87800;"><i class="fas fa-clipboard-check" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>Upcoming Tests</h3>
${items}
        <p>&nbsp;</p>
    </div>`);
  }

  // Birthdays
  if (birthdays && birthdays.trim()) {
    parts.push(`    <div id="kl_custom_block_9" class="">
        <h3 style="background-color: #6644bb; color: #ffffff; border-color: #6644bb;"><i class="fas fa-birthday-cake" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>Birthdays</h3>
        <p style="line-height: 1.5;">${birthdays.trim()}</p>
        <p>&nbsp;</p>
    </div>`);
  }

  // Resources
  if (resources && resources.trim()) {
    const items = resources.split('\n').filter(Boolean).map(renderResourceLine).filter(Boolean).join('\n');
    parts.push(`    <div id="kl_custom_block_5" class="">
        <h3 style="background-color: #00c0a5; color: #ffffff; border-color: #00c0a5;"><i class="fas fa-question" aria-hidden="true"><span class="dp-icon-content" style="display: none;">&nbsp;</span></i>Resources</h3>
${items}
        <p>&nbsp;</p>
    </div>`);
  }

  parts.push(`</div>`);
  return parts.join('\n');
}
