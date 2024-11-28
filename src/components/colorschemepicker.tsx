import { Accessor, Component, createContext, createEffect, createMemo, createResource, For, ParentComponent, Setter, Show, Suspense, useContext } from "solid-js";
import css from './colorschemepicker.module.css';
import { CgDarkMode } from "solid-icons/cg";
import { action, createAsyncStore, query, useAction } from "@solidjs/router";
import { useSession } from "vinxi/http";
import { createStore, reconcile, ReconcileOptions, SetStoreFunction } from "solid-js/store";

export enum ColorScheme {
    Auto = 'light dark',
    Light = 'light',
    Dark = 'dark',
}

const colorSchemes = Object.entries(ColorScheme) as readonly [keyof typeof ColorScheme, ColorScheme][];

export interface State {
    colorScheme: ColorScheme;
    hue: number;
}

const getSession = async () => {
    'use server';

    return useSession<State>({
        password: process.env.SESSION_SECRET!,
    });
};

export const getState = query(async () => {
    'use server';

    const session = await getSession();

    return session.data;
}, 'color-scheme');

const setState = action(async (state: State) => {
    'use server';

    const session = await getSession();
    await session.update(state);
}, 'color-scheme');

interface ThemeContextType {
    readonly theme: State;
    setColorScheme(colorScheme: ColorScheme): void;
    setHue(hue: number): void;
}

const ThemeContext = createContext<ThemeContextType>();

const useStore = () => useContext(ThemeContext)!;

export const useTheme = () => {
    const ctx = useContext(ThemeContext);

    if (ctx === undefined) {
        throw new Error('useColorScheme is called outside a <ColorSchemeProvider />');
    }

    return ctx.theme;
};

export const ThemeProvider: ParentComponent = (props) => {
    const [state, { mutate }] = createResource<State>(() => getState(), { deferStream: true, initialValue: { colorScheme: ColorScheme.Auto, hue: 0 } });
    const updateState = useAction(setState);

    return <Suspense>
        <Show when={state()}>{state => {
            const [store, setStore] = createStore(state());

            createEffect(() => {
                setStore(state());
            });

            return <ThemeContext.Provider value={{
                get theme() { return store; },
                setColorScheme(colorScheme: ColorScheme) { updateState(mutate(prev => ({ ...prev, colorScheme }))) },
                setHue(hue: number) { updateState(mutate(prev => ({ ...prev, hue }))) },
            }}>
                {props.children}
            </ThemeContext.Provider>;
        }}</Show>
    </Suspense>;
};

export const ColorSchemePicker: Component = (props) => {
    const { theme, setColorScheme, setHue } = useStore();

    return <>
        <label class={css.picker} aria-label="Color scheme picker">
            <CgDarkMode />

            <select name="color-scheme-picker" onInput={(e) => {
                if (e.target.value !== theme.colorScheme) {
                    const nextValue = (e.target.value ?? ColorScheme.Auto) as ColorScheme;

                    setColorScheme(nextValue);
                }
            }}>
                <For each={colorSchemes}>{
                    ([label, value]) => <option value={value} selected={value === theme.colorScheme}>{label}</option>
                }</For>
            </select>
        </label>

        <label class={css.hue} aria-label="Hue slider">
            <input type="range" min="0" max="360" value={theme.hue} onInput={e => setHue(e.target.valueAsNumber)} />
        </label>
    </>;
};