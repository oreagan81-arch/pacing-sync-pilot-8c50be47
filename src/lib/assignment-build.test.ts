import { describe, it, expect } from 'vitest';
import { buildAssignment, expandMathRow } from './assignment-build';
import type { PacingCell } from '@/store/useSystemStore';
import type { AppConfig } from './config';

const mockConfig: AppConfig = {
  courseIds: {
    Math: 1,
    Reading: 2,
    Spelling: 2,
    'Language Arts': 3,
    History: 4,
    Science: 5,
  },
  assignmentPrefixes: {
    Math: 'M',
    Reading: 'R',
    Spelling: 'S',
    'Language Arts': 'LA',
    History: 'H',
    Science: 'SC',
  },
  autoLogic: {
    historyScienceNoAssign: true,
    readingFluencyBenchmarks: {},
    readingTestPhrases: [],
  },
};

const mockContentMap = [];

import { FRIDAY_SKIP_REASON } from './friday-rules';
// ... existing code ...
describe('Assignment Engine', () => {
  it('should correctly implement the Friday Rule', async () => {
    const cell: PacingCell = { subject: 'Math', type: 'Homework', lessonNum: '1', value: 'HW', isNoClass: false, isTest: false };
    const assignment = await buildAssignment(cell, 4, mockConfig, mockContentMap);
    expect(assignment.skipReason).toBe(FRIDAY_SKIP_REASON);
  });

  it('should correctly implement the Math Test Triple', async () => {
    const cell: PacingCell = { subject: 'Math', type: 'Test', lessonNum: '1', value: 'Test', isNoClass: false, isTest: true };
    const assignments = await Promise.all(expandMathRow(2, cell, { config: mockConfig, contentMap: mockContentMap }));
    expect(assignments.length).toBe(3);
    expect(assignments[0].type).toBe('Test');
    expect(assignments[1].type).toBe('Fact Test');
    expect(assignments[2].type).toBe('Study Guide');
    expect(assignments[2].dayIndex).toBe(1);
  });
});

