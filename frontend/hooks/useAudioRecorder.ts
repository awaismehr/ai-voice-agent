"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VAD } from "@/lib/constants";

export interface Recording {
  blob: Blob;
  /**
   * False when the level never crossed the speech threshold (the noise gate).
   * */
  hadSpeech: boolean;
}

interface Options {
  /**
   * Fires once when speech was detected and then trailed off into silence.
   * */
  onSilence?: () => void;
}

interface Session {
  stream: MediaStream;
  recorder: MediaRecorder;
  context: AudioContext;
  monitor: ReturnType<typeof setInterval>;
  chunks: Blob[];
  heardSpeech: boolean;
}

function pickMimeType(): string | undefined {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
}

/** Root-mean-square level of the current waveform, 0–1. */
function rmsLevel(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) {
    const centred = (sample - 128) / 128;
    sum += centred * centred;
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Microphone capture with three layers of noise handling:
 *  1. browser-level echo cancellation / noise suppression / auto-gain,
 *  2. voice-activity detection that ends the recording after trailing silence,
 *  3. a noise gate that flags clips which never contained speech.
 * Also exposes an `AnalyserNode` for the live waveform.
 */
export function useAudioRecorder({ onSilence }: Options = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const session = useRef<Session | null>(null);
  const onSilenceRef = useRef(onSilence);

  useEffect(() => {
    onSilenceRef.current = onSilence;
  }, [onSilence]);

  const teardown = useCallback(() => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    clearInterval(current.monitor);
    current.stream.getTracks().forEach((track) => track.stop());
    void current.context.close();
    setIsRecording(false);
    setAnalyser(null);
  }, []);

  const start = useCallback(async () => {
    if (session.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access needs HTTPS or localhost.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const context = new AudioContext();
    const analyserNode = context.createAnalyser();
    analyserNode.fftSize = 1024;
    analyserNode.smoothingTimeConstant = 0.8;
    context.createMediaStreamSource(stream).connect(analyserNode);

    const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const buffer = new Uint8Array(analyserNode.fftSize);
    const startedAt = performance.now();
    let lastSpeechAt = startedAt;
    let silenceFired = false;

    const monitor = setInterval(() => {
      const now = performance.now();
      if (rmsLevel(analyserNode, buffer) > VAD.speechThreshold) {
        if (session.current) session.current.heardSpeech = true;
        lastSpeechAt = now;
      }
      const trailedOff = session.current?.heardSpeech && now - lastSpeechAt > VAD.silenceMs;
      const tooLong = now - startedAt > VAD.maxRecordingMs;
      if ((trailedOff || tooLong) && !silenceFired) {
        silenceFired = true;
        onSilenceRef.current?.();
      }
    }, 50);

    session.current = { stream, recorder, context, monitor, chunks, heardSpeech: false };
    recorder.start();
    setAnalyser(analyserNode);
    setIsRecording(true);
  }, []);

  /** Stops recording and resolves the clip; `null` if nothing was recording. */
  const stop = useCallback((): Promise<Recording | null> => {
    const current = session.current;
    if (!current) return Promise.resolve(null);

    return new Promise((resolve) => {
      current.recorder.onstop = () => {
        resolve({
          blob: new Blob(current.chunks, { type: current.recorder.mimeType }),
          hadSpeech: current.heardSpeech,
        });
      };
      current.recorder.stop();
      teardown();
    });
  }, [teardown]);

  /** Abandons the recording without producing a clip. */
  const cancel = useCallback(() => {
    const current = session.current;
    if (!current) return;
    current.recorder.onstop = null;
    if (current.recorder.state !== "inactive") current.recorder.stop();
    teardown();
  }, [teardown]);

  useEffect(() => cancel, [cancel]);

  return { isRecording, analyser, start, stop, cancel };
}
