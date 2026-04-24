declare module "@toast-ui/editor" {
  export interface EditorOptions {
    el: HTMLElement;
    height?: string;
    minHeight?: string;
    initialValue?: string;
    previewStyle?: "tab" | "vertical";
    initialEditType?: "markdown" | "wysiwyg";
    usageStatistics?: boolean;
  }

  export default class Editor {
    constructor(options: EditorOptions);
    getMarkdown(): string;
    setMarkdown(markdown: string, cursorToEnd?: boolean): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    destroy(): void;
  }
}
