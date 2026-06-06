import { describe, expect, it, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { AtomicCodeMirrorEditor } from '../AtomicCodeMirrorEditor';
import { wikiLinks } from '../wiki-links';

const hosts: HTMLElement[] = [];
const views: EditorView[] = [];

function mountEditor(markdown: string, options: Parameters<typeof wikiLinks>[0] = {}) {
  const wrapper = mount(AtomicCodeMirrorEditor as any, {
    props: {
      markdownSource: markdown,
      extensions: [
        wikiLinks({
          resolve: async (target) => ({ target, label: 'Resolved Target', status: 'resolved' }),
          ...options,
        }),
      ],
    },
    attachTo: document.body,
  });
  hosts.push(wrapper.element as HTMLElement);
  return wrapper;
}

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
  for (const view of views.splice(0)) {
    const parent = view.dom.parentElement;
    view.destroy();
    parent?.remove();
  }
});

function makeView(
  doc: string,
  extensions: Extension,
  selection?: { anchor: number },
): EditorView {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const view = new EditorView({
    parent: host,
    state: EditorState.create({ doc, extensions, selection }),
  });
  views.push(view);
  return view;
}

describe('wikiLinks', () => {
  it('renders labeled wiki links without exposing the target as visible link text', async () => {
    const wrapper = mountEditor('Linked atom: [[atom-123|Project Atlas]]');
    await flushPromises();

    const link = wrapper.element.querySelector<HTMLElement>('.cm-atomic-wiki-link');
    expect(link).not.toBeNull();
    expect(link?.dataset.wikiLinkTarget).toBe('atom-123');
    expect(link?.textContent).toBe('Project Atlas');

    const hiddenSyntax = wrapper.element.querySelector('.cm-atomic-wiki-link-hidden-syntax');
    expect(hiddenSyntax?.textContent).toContain('atom-123');
  });

  it('leaves inline-code wiki-link text untouched', async () => {
    const wrapper = mountEditor('Code: `[[atom-123|Project Atlas]]`');
    await flushPromises();

    expect(wrapper.element.querySelector('.cm-atomic-wiki-link')).toBeNull();
    expect(wrapper.element.textContent).toContain('[[atom-123|Project Atlas]]');
  });

  it('opens on plain click by default when an opener is configured', async () => {
    const onOpen = vi.fn();
    const wrapper = mountEditor('Linked atom: [[atom-123|Project Atlas]]', {
      onOpen,
    });
    await flushPromises();

    wrapper.element.querySelector<HTMLElement>('.cm-atomic-wiki-link')?.click();
    expect(onOpen).toHaveBeenCalledWith('atom-123');
  });

  it('can require modifier-click for opening', async () => {
    const onOpen = vi.fn();
    const wrapper = mountEditor('Linked atom: [[atom-123|Project Atlas]]', {
      onOpen,
      openOnClick: false,
    });
    await flushPromises();

    wrapper.element.querySelector<HTMLElement>('.cm-atomic-wiki-link')?.click();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not resolve a bare wiki link while the cursor is inside it', () => {
    const resolve = vi.fn(async (target: string) => ({ target, label: 'Resolved Target', status: 'resolved' as const }));
    const cursorInsideTarget = 'Draft: [['.length + 2;
    const view = makeView(
      'Draft: [[atom-123]]',
      [wikiLinks({ resolve })],
      { anchor: cursorInsideTarget },
    );

    expect(resolve).not.toHaveBeenCalled();

    view.dispatch({ selection: { anchor: view.state.doc.length } });

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith('atom-123');
  });

  it('does not resolve or decorate bare links rejected by the resolver policy', () => {
    const resolve = vi.fn(async (target: string) => ({ target, label: 'Resolved Target', status: 'resolved' as const }));
    const view = makeView('Draft: [[not-an-atom-id]]', [
      wikiLinks({
        resolve,
        shouldResolve: () => false,
      }),
    ]);

    expect(resolve).not.toHaveBeenCalled();
    expect(view.dom.querySelector('.cm-atomic-wiki-link')).toBeNull();
    expect(view.dom.textContent).toContain('[[not-an-atom-id]]');
  });

  it('reveals a rendered bare link before backspacing through it', () => {
    const doc = 'Before [[missing-target]] after';
    const view = makeView(
      doc,
      [
        wikiLinks({
          resolve: async (target) => ({ target, label: 'Missing atom', status: 'missing' }),
        }),
      ],
      { anchor: 'Before [[missing-target]]'.length },
    );

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    const dispatched = view.contentDOM.dispatchEvent(event);

    expect(dispatched).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe(doc);
    expect(view.state.selection.main.head).toBe('Before [[missing-target'.length);
  });
});
