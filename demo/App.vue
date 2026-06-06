<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  AtomicCodeMirrorEditor,
  wikiLinks,
  type AtomicCodeMirrorEditorHandle,
  type WikiLinkSuggestion,
} from '@atomic-editor/editor';
import { ATOMIC_CODE_LANGUAGES } from '@atomic-editor/editor/code-languages';
import '@atomic-editor/editor/styles.css';
import {
  SAMPLE_SIZES,
  generateSampleMarkdown,
  type SampleSize,
  type SampleOptions,
} from './sample-content';

declare const __APP_VERSION__: string;
const VERSION = __APP_VERSION__;

const WIKI_TARGETS: WikiLinkSuggestion[] = [
  { target: 'demo-project-atlas', label: 'Project Atlas', detail: 'Project' },
  { target: 'demo-meeting-notes', label: 'Meeting Notes', detail: 'Recent' },
  { target: 'demo-editor-roadmap', label: 'Editor Roadmap', detail: 'Planning' },
  { target: 'demo-search-fallback', label: 'Search Fallback', detail: 'Content' },
];

const WIKI_SNIPPETS: Record<string, string> = {
  'demo-project-atlas': 'A project planning page used for labeled wiki-link rendering.',
  'demo-meeting-notes': 'Recent notes with a bare wiki-link target that resolves asynchronously.',
  'demo-editor-roadmap': 'A roadmap page for live preview, autocomplete, and deeplink behavior.',
  'demo-search-fallback': 'Fallback result for testing content-like matching in the demo.',
};

interface ContentToggles {
  images: boolean;
  tables: boolean;
  lists: boolean;
  code: boolean;
}

const DEFAULT_TOGGLES: ContentToggles = {
  images: true,
  tables: true,
  lists: true,
  code: true,
};

const SPOTLIGHTS: { label: string; phrase: string; needs?: keyof ContentToggles }[] = [
  { label: 'Code', phrase: 'Fenced code blocks pick up', needs: 'code' },
  { label: 'Tables', phrase: 'Tables render WYSIWYG', needs: 'tables' },
  { label: 'Checkboxes', phrase: 'Task lists are real checkboxes', needs: 'lists' },
  { label: 'Wiki links', phrase: 'Wiki links connect notes' },
  { label: 'Links', phrase: 'A link to' },
  { label: 'Escapes', phrase: 'Escapes like domain' },
];

function formatBytes(chars: number): string {
  if (chars < 1024) return `${chars} B`;
  if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(1)} KB`;
  return `${(chars / (1024 * 1024)).toFixed(2)} MB`;
}

function findWikiTarget(target: string): WikiLinkSuggestion | undefined {
  return WIKI_TARGETS.find((candidate) => candidate.target === target);
}

function suggestWikiTargets(query: string): Promise<WikiLinkSuggestion[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return Promise.resolve(WIKI_TARGETS);
  return Promise.resolve(
    WIKI_TARGETS.filter((target) => {
      const snippet = WIKI_SNIPPETS[target.target] ?? '';
      return (
        target.label.toLowerCase().includes(normalized) ||
        target.target.toLowerCase().includes(normalized) ||
        snippet.toLowerCase().includes(normalized)
      );
    }),
  );
}

function readLinkedTargetFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('linkedTarget');
}

function togglesToOptions(t: ContentToggles): SampleOptions {
  return {
    mode: t.images ? 'with images' : 'imageless',
    tables: t.tables ? 'with tables' : 'no tables',
    lists: t.lists ? 'with lists' : 'no lists',
    codeBlocks: t.code ? 'with code blocks' : 'no code blocks',
  };
}

const sampleSize = ref<SampleSize>('1 page');
const theme = ref<'dark' | 'light'>('dark');
const toggles = ref<ContentToggles>({ ...DEFAULT_TOGGLES });
const showSource = ref(false);
const liveMarkdown = ref('');
const copied = ref(false);
const resetNonce = ref(0);
const perf = ref({ rendered: 0, total: 0 });
const openedWikiTarget = ref<string | null>(readLinkedTargetFromUrl());
const controlsOpen = ref(false);

const editorRef = ref<AtomicCodeMirrorEditorHandle | null>(null);

const revealText = (() => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('reveal');
})();

const documentId = computed(() =>
  `${sampleSize.value}|${toggles.value.images}|${toggles.value.tables}|${toggles.value.lists}|${toggles.value.code}|${resetNonce.value}`,
);

const storageKey = computed(() =>
  `atomic-demo:${sampleSize.value}|${toggles.value.images}|${toggles.value.tables}|${toggles.value.lists}|${toggles.value.code}`,
);

const markdownSource = computed(() => {
  const generated = generateSampleMarkdown(sampleSize.value, togglesToOptions(toggles.value));
  if (revealText) return generated;
  try {
    const saved = window.localStorage.getItem(storageKey.value);
    if (saved != null) return saved;
  } catch {
    // localStorage unavailable
  }
  return generated;
});

const documentBytes = computed(() => formatBytes(markdownSource.value.length));

watch(theme, (val) => {
  document.documentElement.dataset.theme = val;
});

function setOpenedWikiTarget(v: string | null) {
  openedWikiTarget.value = v;
}

const handlePopState = () => setOpenedWikiTarget(readLinkedTargetFromUrl());
onMounted(() => window.addEventListener('popstate', handlePopState));
onUnmounted(() => window.removeEventListener('popstate', handlePopState));

let perfInterval: number | null = null;
watch(
  () => documentId.value,
  () => {
    if (perfInterval) window.clearInterval(perfInterval);
    perfInterval = window.setInterval(() => {
      const dom = editorRef.value?.getContentDOM();
      const rendered = dom ? dom.querySelectorAll('.cm-line').length : 0;
      const md = editorRef.value?.getMarkdown() ?? '';
      const total = md ? md.split('\n').length : 0;
      perf.value =
        perf.value.rendered === rendered && perf.value.total === total
          ? perf.value
          : { rendered, total };
    }, 600);
  },
  { immediate: true },
);
onUnmounted(() => {
  if (perfInterval) window.clearInterval(perfInterval);
});

function handleMarkdownChange(md: string) {
  try {
    window.localStorage.setItem(storageKey.value, md);
  } catch {
    // Ignore
  }
  if (showSource.value) liveMarkdown.value = md;
}

const wikiLinkExtensions = [
  wikiLinks({
    suggest: suggestWikiTargets,
    resolve: async (target) => {
      const linked = findWikiTarget(target);
      if (!linked) return null;
      return { target, label: linked.label, status: 'resolved' };
    },
    onOpen: (target) => {
      const url = new URL(window.location.href);
      url.searchParams.set('linkedTarget', target);
      window.history.pushState(null, '', url);
      openedWikiTarget.value = target;
    },
    openOnClick: true,
  }),
];

function spotlight(phrase: string) {
  editorRef.value?.revealText(phrase);
}

function toggleSource() {
  showSource.value = !showSource.value;
  if (showSource.value) liveMarkdown.value = editorRef.value?.getMarkdown() ?? '';
}

async function handleCopy() {
  const md = editorRef.value?.getMarkdown() ?? '';
  try {
    await navigator.clipboard.writeText(md);
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard blocked
  }
}

function resetDoc() {
  try {
    window.localStorage.removeItem(storageKey.value);
  } catch {
    // Ignore
  }
  resetNonce.value++;
}

function setToggle(key: keyof ContentToggles) {
  toggles.value = { ...toggles.value, [key]: !toggles.value[key] };
}

const openedWikiLabel = computed(() =>
  openedWikiTarget.value
    ? findWikiTarget(openedWikiTarget.value)?.label ?? openedWikiTarget.value
    : null,
);

const spotlightsFiltered = computed(() =>
  SPOTLIGHTS.filter((s) => !s.needs || toggles.value[s.needs]),
);

const SOURCE_LINE_CAP = 4000;
const sourceLines = computed(() => liveMarkdown.value.split('\n'));
</script>

<template>
  <div class="demo-root" :data-theme="theme">
    <div class="demo-chrome">
      <div class="demo-topbar">
        <h1 class="demo-title">
          <span class="demo-mark-strong">Atomic</span>
          <span class="demo-mark-soft">Editor</span>
        </h1>
        <a
          class="demo-pill demo-pill-accent"
          href="https://www.npmjs.com/package/@atomic-editor/editor"
          target="_blank"
          rel="noopener noreferrer"
        >
          v{{ VERSION }}
        </a>

        <div class="demo-topbar-actions">
          <button
            type="button"
            class="demo-icon-btn"
            @click="theme = theme === 'dark' ? 'light' : 'dark'"
            :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            aria-label="Toggle colour theme"
          >
            <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button
            type="button"
            :class="['demo-btn', 'demo-disclosure', { active: controlsOpen }]"
            @click="controlsOpen = !controlsOpen"
            :aria-expanded="controlsOpen"
          >
            Controls <span class="demo-caret">{{ controlsOpen ? '▾' : '▸' }}</span>
          </button>
          <a
            class="demo-github"
            href="https://github.com/kenforthewin/atomic-editor"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub →
          </a>
        </div>
      </div>

      <div v-if="controlsOpen" class="demo-controls-panel">
        <p class="demo-sub">
          CodeMirror 6 markdown editor with Obsidian-style inline live preview.
          Edit anything below — it stays real markdown.
        </p>

        <div class="demo-toolbar">
          <div class="demo-control">
            <span class="demo-control-label">Sample</span>
            <div class="demo-segmented">
              <button
                v-for="s in SAMPLE_SIZES"
                :key="s"
                type="button"
                :class="{ active: sampleSize === s }"
                @click="sampleSize = s"
              >
                {{ s }}
              </button>
            </div>
            <span class="demo-meta">{{ documentBytes }}</span>
          </div>

          <div class="demo-control">
            <span class="demo-control-label">Content</span>
            <div class="demo-chip-group">
              <button
                type="button"
                :class="['demo-chip', 'demo-chip-toggle', { active: toggles.images }]"
                :aria-pressed="toggles.images"
                @click="setToggle('images')"
              >Images</button>
              <button
                type="button"
                :class="['demo-chip', 'demo-chip-toggle', { active: toggles.tables }]"
                :aria-pressed="toggles.tables"
                @click="setToggle('tables')"
              >Tables</button>
              <button
                type="button"
                :class="['demo-chip', 'demo-chip-toggle', { active: toggles.lists }]"
                :aria-pressed="toggles.lists"
                @click="setToggle('lists')"
              >Lists</button>
              <button
                type="button"
                :class="['demo-chip', 'demo-chip-toggle', { active: toggles.code }]"
                :aria-pressed="toggles.code"
                @click="setToggle('code')"
              >Code</button>
            </div>
          </div>

          <div class="demo-actions">
            <button
              type="button"
              :class="['demo-btn', { active: showSource }]"
              @click="toggleSource"
            >
              {{ showSource ? 'Hide source' : 'Show source' }}
            </button>
            <button type="button" class="demo-btn" @click="handleCopy">
              {{ copied ? 'Copied ✓' : 'Copy markdown' }}
            </button>
            <button type="button" class="demo-btn" @click="resetDoc" title="Discard edits and reload the sample">
              Reset
            </button>
            <span
              class="demo-perf"
              title="CodeMirror 6 only renders the lines in (and near) the viewport — pick a big sample and watch this stay small."
            >
              {{ perf.rendered }} / {{ perf.total }} lines rendered
            </span>
          </div>
        </div>

        <div class="demo-spotlight">
          <span class="demo-control-label">Jump to</span>
          <button
            v-for="s in spotlightsFiltered"
            :key="s.label"
            type="button"
            class="demo-chip"
            @click="spotlight(s.phrase)"
          >
            {{ s.label }}
          </button>
          <span class="demo-spotlight-hint">
            {{ openedWikiLabel
              ? `opened: ${openedWikiLabel} (${openedWikiTarget})`
              : 'Cmd/Ctrl-click a wiki link to open it' }}
          </span>
        </div>
      </div>
    </div>

    <main class="demo-canvas">
      <div class="demo-editor-pane">
        <AtomicCodeMirrorEditor
          :markdown-source="markdownSource"
          :document-id="documentId"
          :code-languages="ATOMIC_CODE_LANGUAGES"
          :initial-reveal-text="revealText ?? undefined"
          :editor-handle-ref="(editorRef as any)"
          :on-markdown-change="handleMarkdownChange"
          :on-link-click="((url: string) => window.open(url, '_blank', 'noopener,noreferrer')) as any"
          :extensions="wikiLinkExtensions"
        />
      </div>
      <aside v-if="showSource" class="demo-source-pane">
        <div class="demo-source-head">Raw markdown — the source of truth</div>
        <template v-if="sourceLines.length > SOURCE_LINE_CAP">
          <pre class="demo-source demo-source-plain">
            <code>{{ liveMarkdown }}</code>
          </pre>
        </template>
        <div v-else class="demo-source">
          <div v-for="(line, i) in sourceLines" :key="i" class="demo-source-line">
            <span class="demo-source-ln">{{ i + 1 }}</span>
            <span class="demo-source-text">{{ line || ' ' }}</span>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>
