"use client";

import { Orb } from "@/components/Orb";
import { useVoiceChatContext } from "@/components/VoiceChatProvider";
import type { VoiceState } from "@/hooks/useVoiceChat";

/** Bar heights (px), tallest next to the orb, tapering away like a decaying sound wave. */
const BAR_HEIGHTS = [64, 44, 70, 38, 56, 30, 40, 22, 28, 16, 18, 10, 8, 5];

/** How lively the hero is in each state: bar cycle time, resting height, sphere drift. */
const MOTION: Record<VoiceState, { dur: string; min: number; drift: string }> = {
  idle: { dur: "2.6s", min: 0.3, drift: "20s" },
  recording: { dur: "0.65s", min: 0.12, drift: "6s" },
  transcribing: { dur: "1.1s", min: 0.25, drift: "3s" },
  thinking: { dur: "1.1s", min: 0.25, drift: "3s" },
  speaking: { dur: "0.8s", min: 0.15, drift: "6s" },
  error: { dur: "3.2s", min: 0.3, drift: "20s" },
};

function Bars({ mirrored }: { mirrored?: boolean }) {
  const bars = BAR_HEIGHTS.map((height, i) => (
    <span
      key={i}
      className={`orb-bar ${i >= 10 ? "max-sm:hidden" : ""}`}
      style={{ height, animationDelay: `${i * -90}ms` }}
    />
  ));
  // The left side lists bars outward-to-inward so the tallest sit beside the orb.
  return (
    <div className="flex items-center gap-[5px]">{mirrored ? bars : bars.reverse()}</div>
  );
}

/** Empty-state hero: a floating orb flanked by waveform bars that react to the voice state. */
export function VoiceOrb() {
  const { state } = useVoiceChatContext();
  const motion = MOTION[state];

  return (
    <div
      aria-hidden
      className="flex w-full items-center justify-center gap-3 sm:gap-5"
      style={
        {
          "--orb-dur": motion.dur,
          "--orb-min": motion.min,
          "--orb-drift": motion.drift,
        } as React.CSSProperties
      }
    >
      <Bars />
      <div className="flex shrink-0 flex-col items-center gap-2">
        <Orb className="animate-orb-float size-28 sm:size-32" />
        <span className="orb-shadow" />
      </div>
      <Bars mirrored />
    </div>
  );
}
