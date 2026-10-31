const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://test.local/' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const schemaApi = require('../dist/cjs/index.js');

const sample = {
  tables: [
    { name: 'people"archive', columns: [{ name: 'id"key', type: 'integer', primaryKey: true }] },
    {
      name: 'notes',
      columns: [
        { name: 'id', type: 'integer', primaryKey: true },
        {
          name: 'person_id',
          type: 'integer',
          reference: { table: 'people"archive', column: 'id"key', onDelete: 'cascade' },
        },
      ],
    },
  ],
};

test('validates relationships and quotes hostile-looking identifiers for each dialect', () => {
  assert.deepEqual(schemaApi.validateSchema(sample), []);
  const postgres = schemaApi.exportSql(sample, 'postgres');
  assert.match(postgres, /"people""archive"/);
  assert.match(postgres, /"id""key" INTEGER PRIMARY KEY/);
  assert.match(postgres, /ON DELETE CASCADE/);
  assert.match(schemaApi.exportSql(sample, 'mysql'), /`people"archive`/);
  assert.match(schemaApi.exportSql(sample, 'sqlite'), /"person_id" INTEGER/);
  assert.throws(
    () =>
      schemaApi.exportSql(
        {
          tables: [
            {
              name: 'bad',
              columns: [
                { name: 'fk', type: 'integer', reference: { table: 'missing', column: 'id' } },
              ],
            },
          ],
        },
        'postgres',
      ),
    /invalid schema/i,
  );
});

test('ESM and CommonJS entry points expose the same API', async () => {
  const esm = await import('../dist/esm/index.js');
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(schemaApi).sort());
});

test('controlled designer emits column additions and dialect selection', async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  let updated;
  let selectedDialect;
  await act(async () =>
    root.render(
      React.createElement(schemaApi.SchemaDesigner, {
        value: schemaApi.createEmptySchema(),
        onChange: (value) => {
          updated = value;
        },
        dialect: 'postgres',
        onDialectChange: (value) => {
          selectedDialect = value;
        },
      }),
    ),
  );
  const addColumn = [...host.querySelectorAll('button')].find(
    (button) => button.textContent === 'Add column',
  );
  await act(async () => addColumn.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(updated.tables[0].columns.length, 3);
  const dialect = host.querySelector('[aria-label="SQL dialect"]');
  Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(
    dialect,
    'sqlite',
  );
  await act(async () => dialect.dispatchEvent(new Event('change', { bubbles: true })));
  assert.equal(selectedDialect, 'sqlite');
  await act(async () => root.unmount());
  host.remove();
});
