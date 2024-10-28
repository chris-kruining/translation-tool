import { Accessor, Component, createEffect, createSignal, For, Setter } from "solid-js";
import css from './colorschemepicker.module.css';

export enum ColorScheme {
    Auto = 'light dark',
    Light = 'light',
    Dark = 'dark',
}

const colorSchemeEntries = [
    [ColorScheme.Auto, 'Auto'],
    [ColorScheme.Light, 'Light'],
    [ColorScheme.Dark, 'Dark'],
] as const;

interface ColorSchemePickerProps {
    value?: Setter<ColorScheme> | [Accessor<ColorScheme>, Setter<ColorScheme>];
}

export const ColorSchemePicker: Component<ColorSchemePickerProps> = (props) => {
    const [value, setValue] = createSignal<ColorScheme>(ColorScheme.Auto);

    createEffect(() => {
        const currentValue = value();
        const setter = props.value instanceof Array ? props.value[1] : props.value;

        if (!setter) {
            return;
        }

        setter(currentValue);
    });

    return <select class={css.picker} name="color-scheme-picker" value={value()} onInput={(e) => {
        if (e.target.value !== value()) {
            setValue(e.target.value as any);
        }
    }}>
        <For each={colorSchemeEntries}>{
            ([value, label]) => <option value={value}>{label}</option>
        }</For>
    </select>;
};