import {
  defineComponent,
  h,
  ref,
  shallowRef,
  watch,
  onMounted,
  onBeforeUnmount,
  type Ref,
  type ShallowRef,
} from 'vue';
import {
  Decoration,
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
  type Panel,
} from '@codemirror/view';
import {
  EditorState,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import { indentOnInput, type LanguageDescription } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from '@codemirror/commands';
import { markdown, markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown';
import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  search,
  searchKeymap,
  searchPanelOpen,
  setSearchQuery,
} from '@codemirror/search';

import { atomicEditorTheme, atomicMarkdownSyntax } from './atomic-theme';
import { autoCloseCodeFence, extendEmphasisPair } from './edit-helpers';
import { imageBlocks } from './image-blocks';
import { inlinePreview } from './inline-preview';
import { tables } from './table-widget';

const EMPTY_CODE_LANGUAGES: readonly LanguageDescription[] = [];
const EMPTY_EXTENSIONS: readonly Extension[] = [];

export interface AtomicCodeMirrorEditorHandle {
  focus: () => void;
  undo: () => void;
  redo: () => void;
  openSearch: (query?: string) => void;
  closeSearch: () => void;
  revealText: (query: string) => void;
  isSearchOpen: () => boolean;
  getMarkdown: () => string;
  getContentDOM: () => HTMLElement | null;
}

export interface AtomicCodeMirrorEditorProps {
  documentId?: string;
  markdownSource: string;
  initialSearchText?: string | null;
  initialRevealText?: string | null;
  blurEditorOnMount?: boolean;
  autofocus?: boolean;
  onMarkdownChange?: (markdown: string) => void;
  onLinkClick?: (url: string) => void;
  /**
   * Translate markdown image URLs before they are set as `<img src>`.
   * Useful in platform shells (Tauri, Electron) where relative paths
   * need to be converted to asset:// or file:// URLs.
   */
  imageSrcResolver?: (src: string) => string;
  editorHandleRef?: Ref<AtomicCodeMirrorEditorHandle | null>;
  codeLanguages?: readonly LanguageDescription[];
  extensions?: readonly Extension[];
}

export const AtomicCodeMirrorEditor = defineComponent({
  name: 'AtomicCodeMirrorEditor',
  props: {
    documentId: { type: String, required: false },
    markdownSource: { type: String, required: true },
    initialSearchText: { type: String, default: null },
    initialRevealText: { type: String, default: null },
    blurEditorOnMount: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
    onMarkdownChange: { type: Function, required: false },
    onLinkClick: { type: Function, required: false },
    imageSrcResolver: { type: Function, required: false },
    editorHandleRef: { type: Object, required: false },
    codeLanguages: { type: Array, default: () => EMPTY_CODE_LANGUAGES },
    extensions: { type: Array, default: () => EMPTY_EXTENSIONS },
  },
  setup(props) {
    const rootRef = ref<HTMLElement | null>(null);
    const viewRef: ShallowRef<EditorView | null> = shallowRef(null);
    let clearRevealTimer: number | null = null;

    const onMarkdownChange = () => props.onMarkdownChange as ((markdown: string) => void) | undefined;
    const onLinkClick = () => props.onLinkClick as ((url: string) => void) | undefined;
    const imageSrcResolver = () => props.imageSrcResolver as ((src: string) => string) | undefined;

    onMounted(() => {
      const root = rootRef.value;
      if (!root) return;

      const view = new EditorView({
        parent: root,
        state: EditorState.create({
          doc: props.markdownSource,
          extensions: [
            highlightSpecialChars(),
            history(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            rectangularSelection(),
            highlightActiveLine(),
            closeBrackets(),
            extendEmphasisPair,
            autoCloseCodeFence,
            EditorView.lineWrapping,
            search({
              top: true,
              createPanel: (innerView) => {
                const panel = defaultSearchPanel(innerView);
                panel.dom.classList.add('atomic-editor-search-panel');
                return panel;
              },
            }),
            markdown({ base: markdownLanguage, codeLanguages: [...(props.codeLanguages as readonly LanguageDescription[])] }),
            markdownLanguage.data.of({
              closeBrackets: { brackets: ['(', '[', '{', "'", '"', '*', '_', '`'] },
            }),
            atomicMarkdownSyntax,
            atomicEditorTheme,
            keymap.of([
              ...closeBracketsKeymap,
              ...historyKeymap,
              ...searchKeymap,
              ...markdownKeymap,
              indentWithTab,
              ...defaultKeymap,
            ]),
            tables({
              onLinkClick: (url) => onLinkClick()?.(url),
              resolveImageSrc: imageSrcResolver(),
            }),
            imageBlocks(imageSrcResolver()),
            inlinePreview({
              onLinkClick: (url) => onLinkClick()?.(url),
            }),
            EditorView.updateListener.of((update) => {
              if (!update.docChanged) return;
              onMarkdownChange()?.(update.state.doc.toString());
            }),
            initialRevealField,
            ...(props.extensions as readonly Extension[]),
          ],
        }),
      });
      viewRef.value = view;

      if (props.initialSearchText) {
        queueMicrotask(() => {
          if (viewRef.value !== view) return;
          view.dispatch({
            effects: setSearchQuery.of(new SearchQuery({ search: props.initialSearchText! })),
          });
          openSearchPanel(view);
        });
      }

      if (props.initialRevealText) {
        revealInitialMatch(view, props.initialRevealText);
      }

      publishHandle();

      if (props.autofocus) {
        view.focus();
      }
    });

    onBeforeUnmount(() => {
      if (clearRevealTimer !== null) {
        window.clearTimeout(clearRevealTimer);
        clearRevealTimer = null;
      }
      if (viewRef.value) {
        viewRef.value.destroy();
        viewRef.value = null;
      }
      clearHandle();
    });

    watch(
      () => props.editorHandleRef,
      () => publishHandle(),
    );

    watch(
      () => props.initialRevealText,
      (text) => {
        if (text && viewRef.value) {
          revealInitialMatch(viewRef.value, text);
        }
      },
    );

    function revealInitialMatch(view: EditorView, queryText: string) {
      const match = findInitialRevealRange(view.state.doc, queryText);
      if (!match) return;

      const { from, to } = match;
      view.dispatch({
        effects: [
          setInitialReveal.of({ from, to }),
          EditorView.scrollIntoView(from, { y: 'start', yMargin: 72 }),
        ],
      });

      requestAnimationFrame(() => {
        if (viewRef.value !== view) return;
        const el =
          view.dom.querySelector('.cm-initialRevealMatch')?.closest('.cm-line') ??
          view.dom.querySelector('.cm-initialRevealMatch');
        if (el instanceof HTMLElement) {
          scrollMatchNearTop(el, 72);
        }
      });

      if (clearRevealTimer !== null) {
        window.clearTimeout(clearRevealTimer);
      }
      clearRevealTimer = window.setTimeout(() => {
        if (viewRef.value !== view) return;
        view.dispatch({ effects: setInitialReveal.of(null) });
        clearRevealTimer = null;
      }, REVEAL_FADE_MS);
    }

    function publishHandle() {
      clearHandle();
      if (!props.editorHandleRef) return;
      props.editorHandleRef.value = {
        focus: () => viewRef.value?.focus(),
        undo: () => {
          const view = viewRef.value;
          if (view) undo(view);
        },
        redo: () => {
          const view = viewRef.value;
          if (view) redo(view);
        },
        openSearch: (query: string) => {
          const view = viewRef.value;
          if (!view) return;
          if (query !== undefined) {
            view.dispatch({
              effects: setSearchQuery.of(new SearchQuery({ search: query })),
            });
          }
          openSearchPanel(view);
        },
        closeSearch: () => {
          const view = viewRef.value;
          if (view) closeSearchPanel(view);
        },
        revealText: (query: string) => {
          const view = viewRef.value;
          if (!view || !query) return;
          revealInitialMatch(view, query);
        },
        isSearchOpen: () => {
          const view = viewRef.value;
          return view ? searchPanelOpen(view.state) : false;
        },
        getMarkdown: () => viewRef.value?.state.doc.toString() ?? '',
        getContentDOM: () => viewRef.value?.contentDOM ?? null,
      };
    }

    function clearHandle() {
      if (props.editorHandleRef && props.editorHandleRef.value) {
        props.editorHandleRef.value = null;
      }
    }

    return () =>
      h('div', {
        ref: rootRef,
        class: 'atomic-cm-editor',
      });
  },
});

// ---------------------------------------------------------------------
// Initial reveal

const setInitialReveal = StateEffect.define<{ from: number; to: number } | null>();

const initialRevealField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setInitialReveal)) continue;
      if (!effect.value) {
        decorations = Decoration.none;
        continue;
      }
      decorations = Decoration.set([
        Decoration.mark({ class: 'cm-initialRevealMatch' }).range(
          effect.value.from,
          effect.value.to,
        ),
      ]);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const REVEAL_FADE_MS = 3200;

function findInitialRevealRange(
  docText: EditorState['doc'],
  queryText: string,
): { from: number; to: number } | null {
  for (const candidate of buildRevealCandidates(queryText)) {
    const query = new SearchQuery({ search: candidate });
    if (!query.valid || !query.search) continue;

    const cursor = query.getCursor(docText);
    const first = cursor.next();
    if (!first.done && first.value.from !== first.value.to) {
      return first.value;
    }
  }

  return null;
}

function buildRevealCandidates(queryText: string): string[] {
  const candidates = new Set<string>();
  const trimmed = queryText.trim();
  if (!trimmed) return [];

  candidates.add(trimmed);

  const collapsed = trimmed.replace(/\s+/g, ' ').trim();
  if (collapsed) candidates.add(collapsed);

  for (const line of trimmed
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)) {
    candidates.add(line);
    const lineCollapsed = line.replace(/\s+/g, ' ').trim();
    if (lineCollapsed) candidates.add(lineCollapsed);
  }

  if (collapsed.length > 140) candidates.add(collapsed.slice(0, 140).trim());
  if (collapsed.length > 80) candidates.add(collapsed.slice(0, 80).trim());

  return [...candidates].filter(
    (candidate) => candidate.length >= 12 || candidate === trimmed,
  );
}

function scrollMatchNearTop(match: HTMLElement, offset: number) {
  const scrollParent = findScrollParent(match);
  if (!scrollParent) {
    match.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const parentRect = scrollParent.getBoundingClientRect();
  const matchRect = match.getBoundingClientRect();
  const nextTop =
    scrollParent.scrollTop + (matchRect.top - parentRect.top) - offset;
  scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
}

function findScrollParent(node: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = node.parentElement;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------
// Search panel

const SEARCH_ICON_PREV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
const SEARCH_ICON_NEXT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const SEARCH_ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

function defaultSearchPanel(view: EditorView): Panel {
  const dom = document.createElement('div');
  dom.className = 'cm-search';
  dom.setAttribute('aria-label', 'Find');

  const form = document.createElement('form');
  form.autocomplete = 'off';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    findNext(view);
  });

  const initial = getSearchQuery(view.state);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search';
  searchInput.value = initial.search;
  searchInput.className = 'cm-atomic-search-input';
  searchInput.setAttribute('main-field', 'true');
  searchInput.setAttribute('aria-label', 'Search');

  const count = document.createElement('span');
  count.className = 'cm-atomic-search-count';
  count.setAttribute('aria-live', 'polite');

  const prevBtn = makeIconButton(
    SEARCH_ICON_PREV,
    'Previous match',
    () => findPrevious(view),
  );
  const nextBtn = makeIconButton(
    SEARCH_ICON_NEXT,
    'Next match',
    () => findNext(view),
  );
  const closeBtn = makeIconButton(
    SEARCH_ICON_CLOSE,
    'Close',
    () => closeSearchPanel(view),
  );

  const recomputeCount = (query: SearchQuery) => {
    if (!query.search) {
      count.textContent = '';
      return;
    }
    try {
      if (!query.valid) {
        count.textContent = '';
        return;
      }
      let n = 0;
      let capped = false;
      const cursor = query.getCursor(view.state.doc);
      while (!cursor.next().done) {
        n++;
        if (n >= 10000) {
          capped = true;
          break;
        }
      }
      count.textContent = capped
        ? '9999+ matches'
        : n === 0
          ? 'No matches'
          : n === 1
            ? '1 match'
            : `${n} matches`;
    } catch {
      count.textContent = '';
    }
  };

  const dispatchQuery = () => {
    const query = new SearchQuery({
      search: searchInput.value,
      caseSensitive: initial.caseSensitive,
      regexp: initial.regexp,
      wholeWord: initial.wholeWord,
    });
    view.dispatch({ effects: setSearchQuery.of(query) });
    recomputeCount(query);
  };

  searchInput.addEventListener('input', dispatchQuery);
  recomputeCount(initial);

  form.append(searchInput, count, prevBtn, nextBtn, closeBtn);
  dom.append(form);

  return {
    dom,
    top: true,
    mount: () => {
      searchInput.focus();
      searchInput.select();
    },
    update: (update) => {
      const next = getSearchQuery(update.state);
      const prev = getSearchQuery(update.startState);
      if (next.search !== prev.search && searchInput.value !== next.search) {
        searchInput.value = next.search;
      }
      if (update.docChanged || next.search !== prev.search) {
        recomputeCount(next);
      }
    },
  };
}

function makeIconButton(
  svg: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'cm-atomic-search-btn';
  el.innerHTML = svg;
  el.setAttribute('aria-label', label);
  el.title = label;
  el.addEventListener('click', onClick);
  return el;
}
