import {Zip, ZipDeflate, ZipPassThrough, strToU8} from 'fflate';

/** Streaming ZIP builder: files are appended as they arrive, the archive is collected into a Blob. */
export class ZipWriter {
  private readonly chunks: Uint8Array[] = [];
  private readonly zip: Zip;
  private readonly done: Promise<Blob>;
  private readonly names = new Set<string>();

  constructor() {
    let resolve!: (blob: Blob) => void;
    let reject!: (err: Error) => void;
    this.done = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.zip = new Zip((err, chunk, final) => {
      if(err) {
        reject(err);
        return;
      }
      this.chunks.push(chunk);
      if(final) resolve(new Blob(this.chunks as BlobPart[], {type: 'application/zip'}));
    });
  }

  /** Returns the path that was actually used (deduplicated) */
  addBinary(path: string, data: Uint8Array): string {
    const name = this.uniqueName(path);
    // Media is already compressed, store it as is.
    const file = new ZipPassThrough(name);
    file.mtime = Date.now();
    this.zip.add(file);
    file.push(data, true);
    return name;
  }

  addText(path: string, text: string): string {
    const name = this.uniqueName(path);
    const file = new ZipDeflate(name, {level: 6});
    file.mtime = Date.now();
    this.zip.add(file);
    file.push(strToU8(text), true);
    return name;
  }

  finish(): Promise<Blob> {
    this.zip.end();
    return this.done;
  }

  terminate() {
    this.zip.terminate();
  }

  private uniqueName(path: string) {
    let name = path;
    for(let i = 1; this.names.has(name); ++i) {
      name = path.replace(/(\.[^./]*)?$/, `_${i}$1`);
    }
    this.names.add(name);
    return name;
  }
}
