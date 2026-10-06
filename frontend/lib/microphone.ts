/** `null` when the Permissions API can't report microphone state (e.g. older Safari). */
async function micPermissionStatus(): Promise<PermissionStatus | null> {
  try {
    return await navigator.permissions.query({ name: "microphone" as PermissionName });
  } catch {
    return null;
  }
}

/**
 * Explains why `getUserMedia` was refused. Browsers only re-show the permission
 * prompt if it was dismissed; once the user chose "Block", only the user can
 * undo it, so the message says how.
 */
export async function describeMicDenial(): Promise<string> {
  const status = await micPermissionStatus();
  return status?.state === "denied"
    ? "Microphone access is blocked for this site. Click the lock icon in the address bar, set Microphone to Allow, then tap the mic again."
    : "Microphone permission wasn't granted. Tap the mic again and choose Allow in the browser prompt.";
}

/** Calls `onChange` whenever the user flips the site's microphone permission. */
export function watchMicPermission(onChange: (state: PermissionState) => void) {
  let status: PermissionStatus | null = null;
  let stopped = false;

  void micPermissionStatus().then((result) => {
    if (stopped || !result) return;
    status = result;
    result.onchange = () => onChange(result.state);
  });

  return () => {
    stopped = true;
    if (status) status.onchange = null;
  };
}
