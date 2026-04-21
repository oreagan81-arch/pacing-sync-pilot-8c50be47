import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AutoLogic {
  mathEvenOdd: boolean;
  mathTestTriple: boolean;
  readingTestPhrases: string[];
  readingFluencyBenchmarks: Record<string, { wpm: number; errors: number }>;
  fridayNoHomework: boolean;
  historyScienceNoAssign: boolean;
  frontPageProtection: boolean;
  pagePublishDefault: boolean;
  togetherLogicCourseId: number;
}

export interface AppConfig {
  courseIds: Record<string, number>;
  assignmentPrefixes: Record<string, string>;
  quarterColors: Record<string, string>;
  powerUpMap: Record<string, string>;
  spellingWordBank: Record<string, string[]>;
  autoLogic: AutoLogic;
  canvasBaseUrl: string;
}

export const ConfigContext = createContext<AppConfig | null>(null);

export function useConfig(): AppConfig | null {
  return useContext(ConfigContext);
}

export function useRequiredConfig(): AppConfig {
  const config = useContext(ConfigContext);
  if (!config) throw new Error('Config not loaded');
  return config;
}

export async function loadConfig(): Promise<AppConfig> {
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('id', 'current')
    .single();

  if (error || !data) throw new Error('Failed to load system config');

  // Validate auto_logic shape before casting
  const autoLogicRaw = data.auto_logic as unknown;
  if (typeof autoLogicRaw !== 'object' || autoLogicRaw === null) {
    throw new Error('Invalid auto_logic in system_config');
  }
  const autoLogic = autoLogicRaw as AutoLogic;
  return {
    // Hardcoded course IDs always win over DB values to prevent drift
    courseIds: { ...(typeof data.course_ids === 'object' && data.course_ids ? (data.course_ids as Record<string, number>) : {}), ...COURSE_IDS },
    assignmentPrefixes: typeof data.assignment_prefixes === 'object' && data.assignment_prefixes ? (data.assignment_prefixes as Record<string, string>) : {},
    quarterColors: typeof data.quarter_colors === 'object' && data.quarter_colors ? (data.quarter_colors as Record<string, string>) : {},
    powerUpMap: typeof data.power_up_map === 'object' && data.power_up_map ? (data.power_up_map as Record<string, string>) : {},
    spellingWordBank: typeof data.spelling_word_bank === 'object' && data.spelling_word_bank ? (data.spelling_word_bank as Record<string, string[]>) : {},
    autoLogic: { ...autoLogic, togetherLogicCourseId: TOGETHER_LOGIC_COURSE_ID },
    canvasBaseUrl: typeof data.canvas_base_url === 'string' ? data.canvas_base_url : 'https://thalesacademy.instructure.com',
  };
}
