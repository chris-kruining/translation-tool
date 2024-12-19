import { describe, expect, it } from "bun:test";
import { createDataSet } from "./dataset";

interface DataEntry {
    id: string;
    name: string;
    amount: number;
};
const defaultData: DataEntry[] = [
    { id: '1', name: 'a first name', amount: 30 },
    { id: '2', name: 'a second name', amount: 20 },
    { id: '3', name: 'a third name', amount: 10 },
];

describe('dataset', () => {
    describe('createDataset', () => {
        it('can create an instance', async () => {
            // Arrange

            // Act
            const actual = createDataSet(defaultData);

            // Assert
            expect(actual).toMatchObject({ data: defaultData })
        });

        it('can sort by a property', async () => {
            // Arrange

            // Act
            const actual = createDataSet(defaultData, { sort: { by: 'amount', reversed: false } });

            // Assert
            expect(actual.nodes()).toEqual([
                expect.objectContaining({ key: 2 }),
                expect.objectContaining({ key: 1 }),
                expect.objectContaining({ key: 0 }),
            ])
        });

        it('can group by a property', async () => {
            // Arrange

            // Act
            const actual = createDataSet(defaultData, { group: { by: 'name' } });

            // Assert
            expect(actual).toEqual(expect.objectContaining({ data: defaultData }))
        });

        describe('mutate', () => {
            it('mutates the value', async () => {
                // Arrange
                const dataset = createDataSet(defaultData);

                // Act
                dataset.mutate(0, 'amount', 100);

                // Assert
                expect(dataset.value[0]!.amount).toBe(100);
            });
        });

        describe('mutateEach', () => {
            it('mutates all the entries', async () => {
                // Arrange
                const dataset = createDataSet(defaultData);

                // Act
                dataset.mutateEach(entry => ({ ...entry, amount: entry.amount + 5 }));

                // Assert
                expect(dataset.value).toEqual([
                    expect.objectContaining({ amount: 35 }),
                    expect.objectContaining({ amount: 25 }),
                    expect.objectContaining({ amount: 15 }),
                ]);
            });
        });

        describe('remove', () => {
            it('removes the 2nd entry', async () => {
                // Arrange
                const dataset = createDataSet(defaultData);

                // Act
                dataset.remove([1]);

                // Assert
                expect(dataset.value[1]).toBeUndefined();
            });
        });

        describe('insert', () => {
            it('adds an entry to the dataset', async () => {
                // Arrange
                const dataset = createDataSet(defaultData);

                // Act
                dataset.insert({ id: '4', name: 'name', amount: 100 });

                // Assert
                expect(dataset.value[3]).toEqual({ id: '4', name: 'name', amount: 100 });
            });
        });

        describe('sort', () => {
            it('can set the sorting', async () => {
                // Arrange
                const dataset = createDataSet(defaultData);

                // Act
                dataset.sort({ by: 'id', reversed: true });

                // Assert
                expect(dataset.sorting).toEqual({ by: 'id', reversed: true });
            });
        });

        describe('group', () => {
            it('can set the grouping', async () => {
                // Arrange
                const dataset = createDataSet(defaultData);

                // Act
                dataset.group({ by: 'id' });

                // Assert
                expect(dataset.grouping).toEqual({ by: 'id' });
            });
        });
    });
});