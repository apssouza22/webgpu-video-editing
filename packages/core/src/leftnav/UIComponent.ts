export abstract class UIComponent<TContext = void> {
  readonly element: HTMLElement;
  protected readonly container: HTMLElement;
  protected readonly context: TContext;

  constructor(container: HTMLElement, context: TContext) {
    this.container = container;
    this.context = context;
    this.element = this.createElement();
    this.container.append(this.element);
    this.bind();
  }

  protected tagRef<T extends HTMLElement>(element: T, name: string): T {
    element.dataset.uiRef = name;
    return element;
  }

  protected ref<T extends HTMLElement>(name: string): T {
    const node = this.element.querySelector<T>(`[data-ui-ref="${name}"]`);
    if (!node) {
      throw new Error(`UI ref "${name}" not found in ${this.constructor.name}`);
    }
    return node;
  }

  /**
   * Subclass `createElement()` runs inside `super()`. With `useDefineForClassFields`,
   * declared fields are reset after `super()` returns — do not assign instance fields
   * there; use DOM refs (`tagRef` / `ref`) or a Symbol-backed store on the root node.
   */
  protected abstract createElement(): HTMLElement;
  protected abstract bind(): void;
}
