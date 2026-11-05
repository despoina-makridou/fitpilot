import { File, Directory, Paths, FileMode } from 'expo-file-system';
import { Asset } from 'expo-asset';
import { MODEL_FILENAME } from '../config';

/**
 * On-device model provisioning (expo-file-system new File API, SDK 54+).
 *
 * The GGUF model (~350MB) can't ship as a single Android asset (Android caps a
 * single packaged asset around 200MB). So at build time we split it into ~40MB
 * chunks in assets/model/ (scripts/split-model.mjs), then on FIRST launch we
 * concatenate those chunks back into one .gguf in the app's document
 * directory. Fully offline; happens once; later launches reuse the cached file.
 */

const modelDir = new Directory(Paths.document, 'model');
const modelFile = new File(modelDir, MODEL_FILENAME);

export const MODEL_PATH = modelFile.uri;

type Manifest = {
  filename: string;
  totalBytes: number;
  chunks: string[]; // relative filenames in assets/model/, in order
};

let manifest: Manifest | null = null;
try {
  // Exists only after `npm run split-model`.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  manifest = require('../../assets/model/manifest.json');
} catch {
  manifest = null;
}

let chunkModules: Record<string, number> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  chunkModules = require('../../assets/model/chunks').chunkModules;
} catch {
  chunkModules = {};
}

export function isModelBundled(): boolean {
  return !!manifest && manifest.chunks.length > 0;
}

export function isModelReady(): boolean {
  if (!modelFile.exists) return false;
  if (manifest && modelFile.size != null && modelFile.size !== manifest.totalBytes) {
    return false;
  }
  return true;
}

/**
 * Ensure the model file exists on disk, reassembling from bundled chunks if
 * needed. Reports progress 0..1. Safe to call every launch (no-op if ready).
 */
export async function ensureModel(onProgress?: (p: number) => void): Promise<string> {
  if (isModelReady()) {
    onProgress?.(1);
    return modelFile.uri;
  }
  if (!manifest) {
    throw new Error(
      'Model chunks are not bundled. Run `npm run split-model` with the .gguf in place.',
    );
  }

  if (!modelDir.exists) modelDir.create({ intermediates: true });
  if (modelFile.exists) modelFile.delete(); // clear any partial/corrupt file
  modelFile.create();

  // Open a handle in append mode and write each chunk's bytes in order.
  const handle = modelFile.open(FileMode.Append);
  try {
    const total = manifest.chunks.length;
    for (let i = 0; i < total; i++) {
      const name = manifest.chunks[i];
      const mod = chunkModules[name];
      if (mod == null) throw new Error(`Missing bundled chunk module for ${name}`);

      // Materialize the packaged asset to a readable local file.
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      const src = new File(asset.localUri ?? asset.uri);

      // Read chunk bytes and append to the growing model file.
      const bytes = await src.bytes();
      handle.writeBytes(bytes);

      onProgress?.((i + 1) / total);
    }
  } finally {
    handle.close();
  }

  if (!isModelReady()) {
    throw new Error('Model reassembly finished but size does not match manifest.');
  }
  return modelFile.uri;
}
