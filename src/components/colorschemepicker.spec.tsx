import { describe, it, expect } from 'bun:test';
import { render } from "@solidjs/testing-library"
import { ColorSchemePicker } from "./colorschemepicker";

// describe('<ColorSchemePicker />', () => {
//     it('should render', async () => {
//         const { getByLabelText } = render(() => <ColorSchemePicker />);

//         const kaas = getByLabelText('Color scheme picker');

//         console.log(kaas);

//         expect(true).toBe(true);
//     });
// });