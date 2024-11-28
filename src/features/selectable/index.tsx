import { Accessor, children, createContext, createEffect, createMemo, createRenderEffect, createSignal, createUniqueId, onCleanup, onMount, ParentComponent, Setter, Signal, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";
import css from "./index.module.css";

enum Modifier {
    None = 0,
    Shift = 1 << 0,
    Control = 1 << 1,
}

enum SelectionMode {
    Normal,
    Replace,
    Append,
    Toggle,
}

export interface SelectionContextType<T extends object = object> {
    readonly selection: Accessor<T[]>;
    readonly length: Accessor<number>;
    select(selection: string[], options?: Partial<{ mode: SelectionMode }>): void;
    selectAll(): void;
    clear(): void;
    isSelected(key: string): Accessor<boolean>;
}
interface InternalSelectionContextType {
    readonly latest: Signal<HTMLElement | undefined>,
    readonly modifier: Signal<Modifier>,
    readonly selectables: Signal<HTMLElement[]>,
    add(key: string, value: object, element: HTMLElement): void;
}
export interface SelectionHandler<T extends object = object> {
    (selection: T[]): any;
}

const SelectionContext = createContext<SelectionContextType>();
const InternalSelectionContext = createContext<InternalSelectionContextType>();

export function useSelection<T extends object = object>(): SelectionContextType<T> {
    const context = useContext(SelectionContext);

    if (context === undefined) {
        throw new Error('selection context is used outside of a provider');
    }

    return context as SelectionContextType<T>;
};
const useInternalSelection = () => useContext(InternalSelectionContext)!;

interface State {
    selection: string[];
    data: { key: string, value: Accessor<any>, element: WeakRef<HTMLElement> }[];
}

export const SelectionProvider: ParentComponent<{ selection?: SelectionHandler, multiSelect?: true }> = (props) => {
    const [state, setState] = createStore<State>({ selection: [], data: [] });
    const selection = createMemo(() => state.data.filter(({ key }) => state.selection.includes(key)));
    const length = createMemo(() => state.data.length);

    createEffect(() => {
        props.selection?.(selection().map(({ value }) => value()));
    });

    const context: SelectionContextType = {
        selection,
        length,
        select(selection, { mode = SelectionMode.Normal } = {}) {
            if (props.multiSelect === true && mode === SelectionMode.Normal) {
                mode = SelectionMode.Toggle;
            }

            setState('selection', existing => {
                switch (mode) {
                    case SelectionMode.Toggle: {
                        return [...existing.filter(i => !selection.includes(i)), ...selection.filter(i => !existing.includes(i))];
                    }

                    case SelectionMode.Append: {
                        return existing.concat(selection);
                    }

                    default: {
                        return selection;
                    }
                }
            });
        },
        selectAll() {
            setState('selection', state.data.map(({ key }) => key));
        },
        clear() {
            setState('selection', []);
        },
        isSelected(key: string) {
            return createMemo(() => state.selection.includes(key));
        },
    };

    const internal: InternalSelectionContextType = {
        modifier: createSignal<Modifier>(Modifier.None),
        latest: createSignal<HTMLElement>(),
        selectables: createSignal<HTMLElement[]>([]),
        add(key: string, value: Accessor<any>, element: HTMLElement) {
            setState('data', data => [...data, { key, value, element: new WeakRef(element) }]);
        },
    };

    return <SelectionContext.Provider value={context}>
        <InternalSelectionContext.Provider value={internal}>
            <Root>{props.children}</Root>
        </InternalSelectionContext.Provider>
    </SelectionContext.Provider>;
};

const Root: ParentComponent = (props) => {
    const internal = useInternalSelection();
    const c = children(() => props.children);

    const [root, setRoot] = createSignal<HTMLElement>();
    const [, setSelectables] = internal.selectables;
    const [, setModifier] = internal.modifier;

    createEffect(() => {
        const r = root();

        if (!isServer && r) {
            const findSelectables = () => {
                setTimeout(() => {
                    setSelectables(Array.from((function* () {
                        const iterator = document.createTreeWalker(r, NodeFilter.SHOW_ELEMENT, {
                            acceptNode: (node: HTMLElement) => node.dataset.selectionKey ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
                        });

                        while (iterator.nextNode()) {
                            yield iterator.currentNode as HTMLElement;
                        }
                    })()));
                }, 100);
            };

            const observer = new MutationObserver(entries => {
                const shouldRecalculate = entries.some(r => r.addedNodes.values().some(node => node instanceof HTMLElement && node.dataset.selectionKey));

                if (shouldRecalculate) {
                    findSelectables();
                }
            });

            findSelectables();

            observer.observe(r, { childList: true, attributes: true, attributeFilter: ['data-selection-key'], subtree: true });
        }
    });

    const onKeyboardEvent = (e: KeyboardEvent) => {
        if (e.repeat || ['Control', 'Shift'].includes(e.key) === false) {
            return;
        }

        setModifier(state => {
            if (e.shiftKey) {
                state |= Modifier.Shift;
            }
            else {
                state &= ~Modifier.Shift;
            }

            if (e.ctrlKey) {
                state |= Modifier.Control;
            }
            else {
                state &= ~Modifier.Control;
            }

            return state;
        });
    };

    return <div ref={setRoot} tabIndex={0} onKeyDown={onKeyboardEvent} onKeyUp={onKeyboardEvent} style={{ 'display': 'contents' }}>{c()}</div>;
};

export const selectable = (element: HTMLElement, options: Accessor<{ value: object, key?: string }>) => {
    const context = useSelection();
    const internal = useInternalSelection();

    const key = options().key ?? createUniqueId();
    const value = createMemo(() => options().value);
    const isSelected = context.isSelected(key);

    internal.add(key, value, element);

    const createRange = (a?: HTMLElement, b?: HTMLElement): string[] => {
        if (!a && !b) {
            return [];
        }

        if (!a) {
            return [b!.dataset.selecatableKey!];
        }

        if (!b) {
            return [a!.dataset.selecatableKey!];
        }

        if (a === b) {
            return [a!.dataset.selecatableKey!];
        }

        const nodes = internal.selectables[0]();
        const aIndex = nodes.indexOf(a);
        const bIndex = nodes.indexOf(b);
        const selection = nodes.slice(Math.min(aIndex, bIndex), Math.max(aIndex, bIndex) + 1);

        return selection.map(n => n.dataset.selectionKey!);
    };

    createRenderEffect(() => {
        if (isSelected()) {
            element.dataset.selected = 'true';
        } else {
            delete element.dataset.selected;
        }
    });

    const onPointerDown = (e: Event) => {
        const [latest, setLatest] = internal.latest
        const [modifier] = internal.modifier

        const withRange = Boolean(modifier() & Modifier.Shift);
        const append = Boolean(modifier() & Modifier.Control);

        const mode = (() => {
            if (append) return SelectionMode.Toggle;
            if (withRange) return SelectionMode.Replace;
            return SelectionMode.Normal;
        })();

        context.select(withRange ? createRange(latest(), element) : [key], { mode });

        if (!withRange) {
            setLatest(element);
        }
    };

    onMount(() => {
        element.addEventListener('pointerdown', onPointerDown);
    });

    onCleanup(() => {
        if (isServer) {
            return;
        }

        element.removeEventListener('pointerdown', onPointerDown);
    });

    element.classList.add(css.selectable);
    element.dataset.selectionKey = key;
};

declare module "solid-js" {
    namespace JSX {
        interface Directives {
            selectable: { value: object, key?: string };
        }
    }
}