import { expect, describe, it, beforeEach, vi } from "vitest"
import { debounce } from "./utilities"

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    })

    it('should run the given callback after the provided time', async () => {
        // Arrange
        const callback = vi.fn(() => { });
        const delay = 1000;
        const debounced = debounce(callback, delay);

        // Act
        debounced();
        vi.runAllTimers();

        // Assert
        expect(callback).toHaveBeenCalled();
    });
});