"use client";

import { useEffect, useRef } from "react";
import { useVoiceChatContext } from "@/components/VoiceChatProvider";
import { cn } from "@/lib/utils";

const BARS = 41;
/** Frequency bins that matter for speech (~0–4 kHz at a 44.1 kHz sample rate). */
const SPEECH_BINS = 96;
const MIN_BAR = 3;

interface Props {
  className?: string;
}

/** Live mic bars (flat line when idle).
 *  Symmetric canvas bars, lowest frequencies in the middle, driven by the analyser. */
export function Waveform({ className }: Props) {
  const { analyser } = useVoiceChatContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);
    context.fillStyle = getComputedStyle(canvas).color;

    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const levels = new Float32Array(BARS);
    const slot = width / BARS;
    const barWidth = Math.min(slot * 0.55, 6);
    const centre = (BARS - 1) / 2;
    let frame = 0;

    const draw = () => {
      analyser?.getByteFrequencyData(data!);
      context.clearRect(0, 0, width, height);

      let peak = 0;
      for (let i = 0; i < BARS; i++) {
        const distance = Math.abs(i - centre) / centre;
        const bin = Math.floor(distance * SPEECH_BINS);
        const target = data ? data[bin] / 255 : 0;
        // Ease towards the target so bars glide instead of flickering.
        levels[i] += (target - levels[i]) * 0.35;
        peak = Math.max(peak, levels[i]);

        const barHeight = Math.max(MIN_BAR, levels[i] ** 1.4 * height);
        context.beginPath();
        context.roundRect(
          i * slot + (slot - barWidth) / 2,
          (height - barHeight) / 2,
          barWidth,
          barHeight,
          barWidth / 2,
        );
        context.fill();
      }
      // Once the bars have settled to the idle line there is nothing to animate.
      if (analyser || peak > 0.01) frame = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("h-14 w-full text-primary", className)}
    />
  );
}
