import {
  BRIDGE_SOURCE,
  MAIN_SOURCE,
  type BridgeToMain,
  type MainToBridge,
  type Reply,
  type RuntimeRequest
} from '../shared/protocol';

// Relays commands between the popup (chrome.runtime) and the MAIN-world script (window.postMessage).
const w = window as unknown as {__tgdlBridge?: boolean};

if(!w.__tgdlBridge) {
  w.__tgdlBridge = true;

  const pending = new Map<string, (reply: Reply) => void>();

  window.addEventListener('message', (event) => {
    if(event.source !== window) return;
    const data = event.data as MainToBridge | undefined;
    if(data?.source !== MAIN_SOURCE) return;
    const resolve = pending.get(data.id);
    if(!resolve) return;
    pending.delete(data.id);
    resolve({result: data.result, error: data.error});
  });

  chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
    if(message?.target !== 'tgdl') return;

    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      sendResponse({error: 'MAIN_TIMEOUT'} satisfies Reply);
    }, 10_000);

    pending.set(id, (reply) => {
      clearTimeout(timer);
      sendResponse(reply);
    });

    const payload: BridgeToMain = {source: BRIDGE_SOURCE, id, command: message.command};
    window.postMessage(payload, location.origin);
    return true;
  });
}
