import { createGoogleCalendarPort } from "./calendar-api";
import type { MirrorRuntimeFactory } from "./calendar-connection";
import {
  GOOGLE_CONFIG_ERROR,
  GoogleCalendarConfigError,
  loadGoogleCalendarConfig,
  type GoogleCalendarConfig,
} from "./config";

/**
 * Server-only composition for the Google Calendar mirror. Both route handlers
 * read the same config shape and build the same runtime, so a missing or bad
 * environment value becomes one concrete Indonesian message rather than two
 * slightly different ones. The browser never imports this module.
 */
export type MirrorConfigResult =
  | { ok: true; config: GoogleCalendarConfig }
  | { ok: false; error: string };

export function readMirrorConfig(): MirrorConfigResult {
  try {
    return { ok: true, config: loadGoogleCalendarConfig() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : GOOGLE_CONFIG_ERROR,
    };
  }
}

export function createMirrorRuntimeFactory(
  result: MirrorConfigResult,
): MirrorRuntimeFactory {
  return () => {
    if (!result.ok) {
      throw new GoogleCalendarConfigError(result.error);
    }
    return {
      config: result.config,
      port: createGoogleCalendarPort(result.config),
    };
  };
}
