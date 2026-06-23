/**
 * chatStreamingStore.ts — état "le chat est en train de répondre".
 *
 * `streaming` vit dans useChat (appelé par ChatKimi). Le header du rail droit
 * (RailRight) en a besoin pour pulser la pastille produit en mode "live", mais
 * ne partage pas le hook. Ce store externe est l'unique seam : ChatKimi le
 * pousse, RailRight le lit. Même forme que activeChatStore (useSyncExternalStore).
 */

type Listener = () => void;
const listeners = new Set<Listener>();
let streaming = false;

function getSnapshot(): boolean { return streaming; }
function getServerSnapshot(): boolean { return false; }

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function setChatStreaming(value: boolean): void {
  if (streaming === value) return;
  streaming = value;
  listeners.forEach((cb) => cb());
}

export { subscribe, getSnapshot, getServerSnapshot, setChatStreaming };
