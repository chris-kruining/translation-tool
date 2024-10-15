import { Accessor, children, createContext, createEffect, createMemo, createRenderEffect, createSignal, createUniqueId, onCleanup, onMount, ParentComponent, useContext } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { isServer } from "solid-js/web";
import css from "./index.module.css";

export interface SelectionContextType {
    selection(): object[];
    select(selection: string[], options?: Partial<{ append: boolean }>): void;
    selectAll(): void;
    clear(): void;
    isSelected(key: string): Accessor<boolean>;
    add(key: string, value: object, element: HTMLElement): void;
}
export type SelectionHandler = (selection: object[]) => any;

enum Modifier {
    None = 0,
    Shift = 1 << 0,
    Control = 1 << 1,
}

const SelectionContext = createContext<SelectionContextType>();

const useSelection = () => {
    const context = useContext(SelectionContext);

    if (context === undefined) {
        throw new Error('selection context is used outside of a provider');
    }

    return context;
};

interface State {
    selection: string[],
    data: { key: string, value: Accessor<any>, element: HTMLElement }[]
}

export const SelectionProvider: ParentComponent<{ selection?: SelectionHandler }> = (props) => {
    const [state, setState] = createStore<State>({ selection: [], data: [] });
    const selection = createMemo(() => state.data.filter(({ key }) => state.selection.includes(key)));

    createEffect(() => {
        props.selection?.(selection().map(({ value }) => value()));
    });

    const context = {
        selection,
        select(selection: string[]) {
            setState('selection', selection);
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
        add(key: string, value: Accessor<any>, element: HTMLElement) {
            setState('data', data => [...data, { key, value, element }]);
        }
    };

    return <SelectionContext.Provider value={context}>
        <Root>{props.children}</Root>
    </SelectionContext.Provider>;
};

const Root: ParentComponent = (props) => {
    const context = useSelection();
    const c = children(() => props.children);

    const [modifier, setModifier] = createSignal<Modifier>(Modifier.None);
    const [latest, setLatest] = createSignal<HTMLElement>();
    const [root, setRoot] = createSignal<HTMLElement>();
    const selectables = createMemo(() => {
        const r = root();

        if (!r) {
            return [];
        }

        return Array.from((function* () {
            const iterator = document.createTreeWalker(r, NodeFilter.SHOW_ELEMENT, {
                acceptNode: (node: HTMLElement) => node.dataset.selectionKey ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
            });

            while (iterator.nextNode()) {
                yield iterator.currentNode;
            }
        })());
    });

    createRenderEffect(() => {
        const children = c.toArray();
        const r = root();

        if (!r) {
            return;
        }

        setTimeout(() => {
            console.log(r, children, Array.from((function* () {
                const iterator = document.createTreeWalker(r, NodeFilter.SHOW_ELEMENT, {
                    acceptNode: (node: HTMLElement) => node.dataset.selectionKey ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
                });

                while (iterator.nextNode()) {
                    console.log(iterator.currentNode);

                    yield iterator.currentNode;
                }
            })()));
        }, 10);
    });

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

        const nodes = selectables();
        const aIndex = nodes.indexOf(a);
        const bIndex = nodes.indexOf(b);
        const selection = nodes.slice(Math.min(aIndex, bIndex), Math.max(aIndex, bIndex) + 1);

        console.log(aIndex, bIndex, nodes,);

        return selection.map(n => n.dataset.selectionKey);
    };

    const onPointerDown = (e: PointerEvent) => {
        const key = e.target?.dataset.selectionKey;

        if (!key) {
            return;
        }

        const shift = Boolean(modifier() & Modifier.Shift);
        const append = Boolean(modifier() & Modifier.Control);

        // Logic table
        // shift | control | behavior                                          |
        // ------|---------|---------------------------------------------------|
        // true  | true    | create range from latest to current and append    |
        // true  | false   | create range from latest to current and overwrite |
        // false | true    | append                                            |
        // false | false   | overwrite / set                                   |

        context.select(shift ? createRange(latest(), e.target as HTMLElement) : [key], { append });
        setLatest(e.target);
    };

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

    onMount(() => {
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyboardEvent);
        document.addEventListener('keyup', onKeyboardEvent);
    });

    onCleanup(() => {
        if (isServer) {
            return;
        }

        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('keydown', onKeyboardEvent);
        document.removeEventListener('keyup', onKeyboardEvent);
    });

    createEffect(() => {
        console.log(selectables());
    });

    return <div ref={setRoot} style={{ 'display': 'contents' }}>{c()}</div>;
};

export const selectable = (element: HTMLElement, value: Accessor<any>) => {
    const context = useSelection();
    const key = createUniqueId();
    const isSelected = context.isSelected(key);

    context.add(key, value, element);

    createRenderEffect(() => {
        element.dataset.selected = isSelected() ? 'true' : undefined;
    });

    element.classList.add(css.selectable);
    element.dataset.selectionKey = key;
};

declare module "solid-js" {
    namespace JSX {
        interface Directives {
            selectable: any;
        }
    }
}