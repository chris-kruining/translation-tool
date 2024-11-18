import { Component, createEffect, createMemo, createResource, For, Setter } from "solid-js";
import css from './colorschemepicker.module.css';
import { CgDarkMode } from "solid-icons/cg";
import { action, cache, useAction } from "@solidjs/router";
import { useSession } from "vinxi/http";

export enum ColorScheme {
    Auto = 'light dark',
    Light = 'light',
    Dark = 'dark',
}
type ColorSchemeKey = keyof typeof ColorScheme;

const colorSchemeKeys: readonly ColorSchemeKey[] = ['Auto', 'Light', 'Dark'] as const;

interface ColorSchemePickerProps {
    value?: Setter<ColorScheme>;
}

const getSession = async () => {
    'use server';

    return useSession<{ colorScheme: ColorSchemeKey }>({
        password: process.env.SESSION_SECRET ?? 'some_static_password_because_untill_I_figure_out_env_files...',
    });
};

export const getColorScheme = cache(async () => {
    'use server';

    const session = await getSession();

    return session.data.colorScheme;
}, 'color-scheme');

const setColorScheme = action(async (colorScheme: ColorSchemeKey) => {
    'use server';

    const session = await getSession();
    await session.update({ colorScheme });
}, 'color-scheme');

export const ColorSchemePicker: Component<ColorSchemePickerProps> = (props) => {
    const [value, { mutate }] = createResource<ColorSchemeKey>(() => getColorScheme(), { initialValue: 'Auto' });
    const updateStore = useAction(setColorScheme);

    createEffect(() => {
        props.value?.(ColorScheme[value()]);
    });

    return <label class={css.picker} aria-label="Color scheme picker">
        <CgDarkMode />

        <select name="color-scheme-picker" onInput={(e) => {
            if (e.target.value !== value()) {
                const nextValue = (e.target.value ?? 'Auto') as ColorSchemeKey;

                mutate(nextValue);
                updateStore(nextValue);
            }
        }}>
            <For each={colorSchemeKeys}>{
                (v) => <option value={v} selected={v === value()}>{v}</option>
            }</For>
        </select>
    </label>;
};