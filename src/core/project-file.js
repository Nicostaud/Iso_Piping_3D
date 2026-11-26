/**
 * Project files (.isop): UTF-8 JSON
 *   { "app": "iso-piping-3d", "format": 1, "savedAt": ISO8601, "model": M }
 * Opening also accepts a raw model JSON (v1 to v4, e.g. files saved by V4.1).
 * Every model goes through normalize().
 */
import { normalize } from './model.js';

export const APP_ID = 'iso-piping-3d';
export const FORMAT = 1;
export const EXT = '.isop';
export const MIME = 'application/json';

/**
 * @param {object} model current model (v:4)
 * @param {Date} [now]
 * @returns {string} file text
 */
export function serializeProject(model, now = new Date()) {
  return JSON.stringify({ app: APP_ID, format: FORMAT, savedAt: now.toISOString(), model }, null, 1);
}

/**
 * @param {string} text file content
 * @returns {{ model: object, wrapped: boolean, savedAt: string|null }}
 *   wrapped = true for an .isop envelope, false for a raw model
 * @throws {Error} when the content is not a project or a model
 */
export function parseProject(text) {
  const o = JSON.parse(String(text).replace(/^﻿/, ''));
  if (o && typeof o === 'object' && o.app === APP_ID) {
    if (!(+o.format >= 1)) throw new Error('format');
    if (+o.format > FORMAT) throw new Error('newer');
    return { model: normalize(o.model), wrapped: true, savedAt: typeof o.savedAt === 'string' ? o.savedAt : null };
  }
  return { model: normalize(o), wrapped: false, savedAt: null };
}

/**
 * Project file name for a document: keeps an existing .isop name,
 * otherwise derives one from the base name.
 * @param {string|null} current name of the opened file, if any
 * @param {string} base fallback base name (line or project number)
 */
export function projectFileName(current, base) {
  if (current && current.toLowerCase().endsWith(EXT)) return current;
  const stem = current ? current.replace(/\.[^.]*$/, '') : base;
  return (stem || 'iso-piping') + EXT;
}
