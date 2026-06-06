import { type Ref } from 'vue';
import { type Extension } from '@codemirror/state';
import { type LanguageDescription } from '@codemirror/language';
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
export declare const AtomicCodeMirrorEditor: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    documentId: {
        type: StringConstructor;
        required: false;
    };
    markdownSource: {
        type: StringConstructor;
        required: true;
    };
    initialSearchText: {
        type: StringConstructor;
        default: null;
    };
    initialRevealText: {
        type: StringConstructor;
        default: null;
    };
    blurEditorOnMount: {
        type: BooleanConstructor;
        default: boolean;
    };
    autofocus: {
        type: BooleanConstructor;
        default: boolean;
    };
    onMarkdownChange: {
        type: FunctionConstructor;
        required: false;
    };
    onLinkClick: {
        type: FunctionConstructor;
        required: false;
    };
    imageSrcResolver: {
        type: FunctionConstructor;
        required: false;
    };
    editorHandleRef: {
        type: ObjectConstructor;
        required: false;
    };
    codeLanguages: {
        type: ArrayConstructor;
        default: () => readonly LanguageDescription[];
    };
    extensions: {
        type: ArrayConstructor;
        default: () => readonly Extension[];
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    documentId: {
        type: StringConstructor;
        required: false;
    };
    markdownSource: {
        type: StringConstructor;
        required: true;
    };
    initialSearchText: {
        type: StringConstructor;
        default: null;
    };
    initialRevealText: {
        type: StringConstructor;
        default: null;
    };
    blurEditorOnMount: {
        type: BooleanConstructor;
        default: boolean;
    };
    autofocus: {
        type: BooleanConstructor;
        default: boolean;
    };
    onMarkdownChange: {
        type: FunctionConstructor;
        required: false;
    };
    onLinkClick: {
        type: FunctionConstructor;
        required: false;
    };
    imageSrcResolver: {
        type: FunctionConstructor;
        required: false;
    };
    editorHandleRef: {
        type: ObjectConstructor;
        required: false;
    };
    codeLanguages: {
        type: ArrayConstructor;
        default: () => readonly LanguageDescription[];
    };
    extensions: {
        type: ArrayConstructor;
        default: () => readonly Extension[];
    };
}>> & Readonly<{}>, {
    initialSearchText: string;
    initialRevealText: string;
    blurEditorOnMount: boolean;
    autofocus: boolean;
    codeLanguages: unknown[];
    extensions: unknown[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
//# sourceMappingURL=AtomicCodeMirrorEditor.d.ts.map