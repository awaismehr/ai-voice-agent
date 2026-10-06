"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVoiceChatContext } from "@/components/VoiceChatProvider";
import { PERSONAS, VOICES, type PersonaId, type Voice } from "@/lib/constants";

const VOICE_ITEMS = VOICES.map((v) => ({ value: v.id, label: `${v.label} · ${v.hint}` }));
const PERSONA_ITEMS = PERSONAS.map((p) => ({ value: p.id, label: p.label }));

export function SettingsBar() {
  const { voice, persona, setVoice, setPersona, reset } = useVoiceChatContext();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={PERSONA_ITEMS}
        value={persona}
        onValueChange={(value) => value && setPersona(value as PersonaId)}
      >
        <SelectTrigger aria-label="Persona" className="min-w-0 flex-1 sm:flex-none sm:min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERSONA_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={VOICE_ITEMS}
        value={voice}
        onValueChange={(value) => value && setVoice(value as Voice)}
      >
        <SelectTrigger aria-label="Voice" className="min-w-0 flex-1 sm:flex-none sm:min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VOICE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" onClick={() => void reset()} className="ml-auto">
              <RotateCcw /> Reset
            </Button>
          }
        />
        <TooltipContent>Clear this conversation and start over</TooltipContent>
      </Tooltip>
    </div>
  );
}
