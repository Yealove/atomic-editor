import { describe, expect, it, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import {
  AtomicCodeMirrorEditor,
  type AtomicCodeMirrorEditorHandle,
} from '../AtomicCodeMirrorEditor';

const hosts: HTMLElement[] = [];

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

describe('AtomicCodeMirrorEditor', () => {
  it('mounts and exposes the initial markdown via the imperative handle', async () => {
    const handleRef = ref<AtomicCodeMirrorEditorHandle | null>(null);

    const wrapper = mount(AtomicCodeMirrorEditor as any, {
      props: {
        markdownSource: '# Hello\n\nWorld.',
        editorHandleRef: handleRef,
      },
      attachTo: document.body,
    });
    hosts.push(wrapper.element as HTMLElement);

    await flushPromises();

    expect(handleRef.value).not.toBeNull();
    expect(handleRef.value?.getMarkdown()).toBe('# Hello\n\nWorld.');
  });

  it('renders `.cm-content` with the raw markdown visible in the DOM', async () => {
    const wrapper = mount(AtomicCodeMirrorEditor as any, {
      props: {
        markdownSource: '**bold** and *em*',
      },
      attachTo: document.body,
    });
    hosts.push(wrapper.element as HTMLElement);

    await flushPromises();

    const content = wrapper.element.querySelector('.cm-content');
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain('bold');
    expect(content?.textContent).toContain('em');
  });
});
