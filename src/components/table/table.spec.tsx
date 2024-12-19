import { describe, it, expect } from 'bun:test';
import { render } from "@solidjs/testing-library"
import { Table } from './table';
import { createDataSet } from './dataset';

type TableItem = {};

// describe('<Table />', () => {
//     it('should render', async () => {
//         const dataset = createDataSet<TableItem>([]);
//         const result = render(() => <Table rows={dataset} columns={[]} />);

//         expect(true).toBe(true);
//     });
// });