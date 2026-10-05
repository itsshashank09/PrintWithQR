import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEUE_WAIT_MS, waitingDeadline, waitingExpired, documentSeconds, customerQueueStatus } from '../api/_lib/queue-clock.js';
import { expireWaitingOrder, deleteOrderFiles } from '../api/_lib/queue-cleanup.js';
const now = Date.parse('2026-10-03T10:00:00Z');
const order = { id: 'synthetic', shop_id: 'synthetic-shop', status: 'Pending', created_at: new Date(now - QUEUE_WAIT_MS).toISOString(), file_path: 'synthetic-shop/generated.pdf', print_options: { documentPages: 3 } };

test('queue uses creation time: exact boundary, reload stability, Printing preservation, private receipt expiry', () => {
  assert.equal(waitingDeadline(order), now);
  assert.equal(waitingExpired(order, now - 1), false);
  assert.equal(waitingExpired(order, now), true);
  assert.equal(waitingDeadline(JSON.parse(JSON.stringify(order))), now);
  const printing = { ...order, status: 'Printing' };
  assert.equal(waitingDeadline(printing), null);
  assert.equal(waitingExpired(printing, now + QUEUE_WAIT_MS * 2), false);
  assert.equal(documentSeconds(printing, now), 120);
  assert.equal(documentSeconds(order, now), 0);
  assert.equal(documentSeconds({ ...order, created_at: new Date(now - QUEUE_WAIT_MS + 30000).toISOString() }, now), 30);
  assert.equal(customerQueueStatus(order, now - 1).status, 'Pending');
  const receipt = customerQueueStatus(order, now);
  assert.equal(receipt.status, 'Cancelled');
  assert.equal(receipt.print_options.documentPages, 3);
  assert.equal(receipt.print_options.queueExpiredAt, new Date(now).toISOString());
  assert.equal(documentSeconds({ ...receipt, completed_at: new Date(now).toISOString() }, now), 0);
  assert.equal(documentSeconds({ ...order, status: 'Completed', completed_at: new Date(now).toISOString() }, now), 120);
  assert.equal(documentSeconds({ ...order, status: 'Completed', completed_at: new Date(now - QUEUE_WAIT_MS).toISOString() }, now), 0);
});

function fake({ raced = false, removalFails = false } = {}) {
  const state = { row: { ...order, print_options: { ...order.print_options } }, removed: [], marks: 0 };
  const client = {
    from(table) {
      assert.equal(table, 'orders');
      let update, matches = true;
      const q = {
        update(value) { update = value; return q; },
        eq(key, value) { matches &&= state.row[key] === value; return q; },
        lte(key, value) { matches &&= state.row[key] <= value; return q; },
        is(key, value) { matches &&= (state.row[key] ?? null) === value; return q; },
        in(key, values) { matches &&= values.includes(state.row[key]); return q; },
        async select() {
          if (raced) { state.row.status = 'Printing'; return { data: [] }; }
          if (!matches) return { data: [] };
          Object.assign(state.row, update); return { data: [{ id: state.row.id }] };
        },
        // Supabase builders are intentionally thenable; this mock mirrors them.
        // oxlint-disable-next-line unicorn/no-thenable
        then(resolve) {
          if (matches) { Object.assign(state.row, update); state.marks++; }
          return Promise.resolve({ error: null }).then(resolve);
        }
      }; return q;
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'print-jobs');
      return { async remove(keys) { if (removalFails) return { error: new Error('offline') }; state.removed.push(...keys); return { error: null }; } };
    } }
  };
  return { client, state };
}

test('conditional expiry preserves pricing metadata, records cancellation, and deletes actual Storage files', async () => {
  const { client, state } = fake();
  assert.equal(await expireWaitingOrder(client, order, now), true);
  assert.equal(state.row.status, 'Cancelled');
  assert.equal(state.row.print_options.documentPages, 3);
  assert.ok(state.row.print_options.queueExpiredAt);
  assert.equal(await deleteOrderFiles(client, state.row, now), 1);
  assert.deepEqual(state.removed, ['synthetic-shop/generated.pdf']);
  assert.equal(state.row.file_deleted_at, new Date(now).toISOString());
  assert.equal(state.row.id, order.id); // Cancelled history remains.
});

test('Printing wins a race with cleanup; not-yet-expired and Printing orders cannot be claimed', async () => {
  const { client, state } = fake({ raced: true });
  assert.equal(await expireWaitingOrder(client, order, now), false);
  assert.equal(state.row.status, 'Printing');
  assert.deepEqual(state.removed, []);
  assert.equal(await expireWaitingOrder(client, order, now - 1), false);
  assert.equal(await expireWaitingOrder(client, { ...order, status: 'Printing' }, now), false);
});

test('failed deletion stays cancelled and inaccessible; later retry deletes without another retention wait', async () => {
  const failed = fake({ removalFails: true });
  await expireWaitingOrder(failed.client, order, now);
  await assert.rejects(deleteOrderFiles(failed.client, failed.state.row, now), { status: 503 });
  assert.equal(failed.state.row.file_deleted_at, undefined);
  assert.equal(documentSeconds(failed.state.row, now), 0);
  assert.equal(failed.state.marks, 0);
  const retry = fake(); retry.state.row = failed.state.row;
  await deleteOrderFiles(retry.client, retry.state.row, now + 60000);
  assert.equal(retry.state.removed.length, 1);
  assert.ok(retry.state.row.file_deleted_at);
});
