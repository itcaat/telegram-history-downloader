// Access to the internals that Telegram WebK (github.com/morethanwords/tweb) mounts on `window`.
// Managers live in a worker; every call goes through a proxy and returns a Promise.

import type {ChatInfo, Locale} from '../shared/protocol';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type TL = any;

interface TwebWindow {
  rootScope?: {
    myId?: number;
    managers?: {
      apiManager: {invokeApi(method: string, params: object, options?: object): Promise<TL>};
      apiFileManager: {download(options: object): Promise<Blob>};
      appPeersManager: {
        getPeer(peerId: number): Promise<TL>;
        getInputPeerById(peerId: number): Promise<TL>;
      };
    };
  };
  appImManager?: {
    chat?: {peerId?: number, threadId?: number};
  };
}

const tw = window as unknown as TwebWindow;

export function getManagers() {
  const managers = tw.rootScope?.managers;
  if(!managers) throw new Error('Telegram WebK is not ready');
  return managers;
}

export function isReady() {
  return !!tw.rootScope?.managers && !!tw.appImManager && !!tw.rootScope.myId;
}

export function getMyId() {
  return Number(tw.rootScope?.myId ?? 0);
}

export function getCurrentPeerId(): number | undefined {
  const peerId = tw.appImManager?.chat?.peerId;
  return peerId ? Number(peerId) : undefined;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function errorType(err: unknown): string {
  if(typeof err === 'string') return err;
  if(err && typeof err === 'object') {
    const e = err as {type?: string, message?: string};
    return e.type || e.message || JSON.stringify(err);
  }
  return String(err);
}

export function describeError(err: unknown) {
  return errorType(err);
}

/** invokeApi with extra FLOOD_WAIT handling on top of WebK's own. */
export async function invokeApi(method: string, params: object, options?: object): Promise<TL> {
  const {apiManager} = getManagers();
  for(let attempt = 0; ; ++attempt) {
    try {
      return await apiManager.invokeApi(method, params, options);
    } catch(err) {
      const type = errorType(err);
      const flood = type.match(/FLOOD_WAIT_(\d+)/);
      if(flood && attempt < 5) {
        await sleep((Number(flood[1]) + 1) * 1000);
        continue;
      }
      throw err;
    }
  }
}

export function userName(user: TL | undefined): string {
  if(!user) return '';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return name || (user.username ? '@' + user.username : '');
}

export function peerUsername(peer: TL | undefined): string | undefined {
  if(!peer) return undefined;
  return peer.username || peer.usernames?.find((u: TL) => u.active)?.username || undefined;
}

export async function getChatInfo(locale: Locale = 'en'): Promise<ChatInfo | null> {
  const peerId = getCurrentPeerId();
  if(!peerId) return null;

  const peer = await getManagers().appPeersManager.getPeer(peerId);
  const username = peerUsername(peer);

  if(peerId === getMyId()) {
    return {peerId, title: locale === 'ru' ? 'Избранное' : 'Saved Messages', kind: 'saved', username};
  }

  if(peer?._ === 'user') {
    return {
      peerId,
      title: userName(peer) || (locale === 'ru' ? 'Удалённый аккаунт' : 'Deleted Account'),
      kind: peer.bot ? 'bot' : 'user',
      username
    };
  }

  return {
    peerId,
    title: peer?.title || String(peerId),
    kind: peer?._ === 'channel' && peer.broadcast ? 'channel' : 'group',
    username
  };
}
