/**
 * Global voice control: stop all TTS/audio before starting new playback.
 * Call stopAllVoice() before playing any voice; components listen for
 * STOP_ALL_VOICE_EVENT and stop their own playback.
 */

export const STOP_ALL_VOICE_EVENT = "stop-all-voice";

export function stopAllVoice(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
  window.dispatchEvent(new CustomEvent(STOP_ALL_VOICE_EVENT));
}
