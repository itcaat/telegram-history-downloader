import {
  BRIDGE_SOURCE,
  MAIN_SOURCE,
  type BridgeToMain,
  type Command,
  type ExportOptions,
  type MainToBridge,
  type PageState
} from '../shared/protocol';
import {ExportJob} from './exporter';
import {describeError, getChatInfo, isReady} from './tweb';

const w = window as unknown as {__tgdlMain?: boolean};

if(!w.__tgdlMain) {
  w.__tgdlMain = true;

  let job: ExportJob | null = null;
  let lastLocale: ExportOptions['locale'] = 'en';

  const getState = async(): Promise<PageState> => {
    const ready = isReady();
    return {
      ready,
      chat: ready ? await getChatInfo(lastLocale) : null,
      job: job ? {...job.state} : null
    };
  };

  const handle = async(command: Command): Promise<PageState> => {
    switch(command.type) {
      case 'getState':
        return getState();

      case 'start': {
        if(job?.state.status === 'running') throw new Error('ALREADY_RUNNING');
        lastLocale = command.options.locale;
        if(!isReady()) throw new Error('NOT_READY');
        const chat = await getChatInfo(lastLocale);
        if(!chat) throw new Error('NO_CHAT');
        job = new ExportJob(chat, command.options);
        void job.run();
        return getState();
      }

      case 'cancel':
        job?.cancel();
        return getState();

      case 'reset':
        if(job?.state.status !== 'running') job = null;
        return getState();
    }
  };

  window.addEventListener('message', async(event) => {
    if(event.source !== window) return;
    const data = event.data as BridgeToMain | undefined;
    if(data?.source !== BRIDGE_SOURCE) return;

    const reply: MainToBridge = {source: MAIN_SOURCE, id: data.id};
    try {
      reply.result = await handle(data.command);
    } catch(err) {
      reply.error = describeError(err);
    }
    window.postMessage(reply, location.origin);
  });
}
