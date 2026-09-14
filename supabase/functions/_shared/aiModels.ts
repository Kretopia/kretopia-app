// Centralized Gemini model-string constants for the Lovable AI Gateway.
//
// google/gemini-2.5-flash and google/gemini-2.5-pro are confirmed to retire
// on 2026-10-16. When Google's replacement model is confirmed, updating the
// values below is the ENTIRE fix needed -- every edge function that calls
// the gateway imports these constants instead of hardcoding the model
// string, so there is no other file to touch.
//
// Do not change these values speculatively. Swap them only once the actual
// replacement model has been confirmed by whoever owns the Lovable AI
// Gateway relationship.

export const GEMINI_FLASH = "google/gemini-2.5-flash";
export const GEMINI_FLASH_LITE = "google/gemini-2.5-flash-lite";
export const GEMINI_PRO = "google/gemini-2.5-pro";
export const GEMINI_FLASH_IMAGE = "google/gemini-2.5-flash-image";
export const GEMINI_FLASH_IMAGE_PREVIEW = "google/gemini-2.5-flash-image-preview";
