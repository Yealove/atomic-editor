import { describe, expect, it, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { AtomicCodeMirrorEditor } from '../AtomicCodeMirrorEditor';

const hosts: HTMLElement[] = [];

function mountEditor(markdown: string) {
  const wrapper = mount(AtomicCodeMirrorEditor as any, {
    props: { markdownSource: markdown },
    attachTo: document.body,
  });
  hosts.push(wrapper.element as HTMLElement);
  return wrapper;
}

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

describe('multi-line markdown nodes do not crash the inline-preview plugin', () => {
  it.each([
    ['multi-line link title', '[label](https://example.com "first line\nsecond line")'],
    ['multi-line image title', '![alt](https://example.com/x.png "first\nsecond")'],
  ])('%s', async (_name, markdown) => {
    expect(() => {
      mountEditor(markdown);
      // flushPromises is synchronous in happy-dom
    }).not.toThrow();
  });
});
