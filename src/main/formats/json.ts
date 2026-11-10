import type {ExportDocument} from './document';

export function toJson(doc: ExportDocument): string {
  return JSON.stringify({
    chat: {
      id: doc.chat.peerId,
      title: doc.chat.title,
      type: doc.chat.kind,
      username: doc.chat.username
    },
    exported_at: new Date(doc.exportedAt).toISOString(),
    range: doc.range,
    messages_count: doc.messages.length,
    messages: doc.messages
  }, null, 2);
}
