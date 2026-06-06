import { type Extension } from '@codemirror/state';
/**
 * Create the image-blocks extension. Accepts an optional `resolveSrc`
 * callback that translates markdown image URLs before they are set as
 * `<img src>` — e.g. converting relative paths to platform-specific
 * asset:// URLs in Tauri / Electron. When omitted the raw source is
 * used unchanged.
 */
export declare function imageBlocks(resolveSrc?: (src: string) => string): Extension;
//# sourceMappingURL=image-blocks.d.ts.map