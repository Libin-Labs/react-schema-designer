import type * as React from 'react';

export type ColumnType = 'integer' | 'real' | 'text' | 'boolean' | 'date' | 'datetime' | 'json';
export type SqlDialect = 'postgres' | 'mysql' | 'sqlite';
export interface ForeignKey {
  table: string;
  column: string;
  onDelete?: 'cascade' | 'set null' | 'restrict' | 'no action';
}
export interface SchemaColumn {
  name: string;
  type: ColumnType;
  nullable?: boolean;
  primaryKey?: boolean;
  reference?: ForeignKey;
}
export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}
export interface RelationalSchema {
  tables: SchemaTable[];
}
export interface SchemaIssue {
  path: string;
  message: string;
}

function validIdentifier(value: string): boolean {
  return value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}

export function validateSchema(schema: RelationalSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const tableNames = new Set<string>();
  for (const [tableIndex, table] of schema.tables.entries()) {
    const tablePath = `tables.${tableIndex}`;
    if (!validIdentifier(table.name))
      issues.push({
        path: `${tablePath}.name`,
        message: 'Table name must be non-empty and contain no control characters.',
      });
    if (tableNames.has(table.name.toLowerCase()))
      issues.push({ path: `${tablePath}.name`, message: `Duplicate table "${table.name}".` });
    tableNames.add(table.name.toLowerCase());
    if (table.columns.length === 0)
      issues.push({
        path: `${tablePath}.columns`,
        message: 'A table must contain at least one column.',
      });
    const columnNames = new Set<string>();
    let primaryKeys = 0;
    for (const [columnIndex, column] of table.columns.entries()) {
      const path = `${tablePath}.columns.${columnIndex}`;
      if (!validIdentifier(column.name))
        issues.push({
          path: `${path}.name`,
          message: 'Column name must be non-empty and contain no control characters.',
        });
      if (columnNames.has(column.name.toLowerCase()))
        issues.push({ path: `${path}.name`, message: `Duplicate column "${column.name}".` });
      columnNames.add(column.name.toLowerCase());
      if (
        !['integer', 'real', 'text', 'boolean', 'date', 'datetime', 'json'].includes(column.type)
      ) {
        issues.push({ path: `${path}.type`, message: `Unsupported column type "${column.type}".` });
      }
      if (column.primaryKey) primaryKeys++;
      if (column.primaryKey && column.nullable)
        issues.push({ path: `${path}.nullable`, message: 'A primary key cannot be nullable.' });
      if (column.reference) {
        const target = schema.tables.find(
          (candidate) => candidate.name.toLowerCase() === column.reference?.table.toLowerCase(),
        );
        const targetColumn = target?.columns.find(
          (candidate) => candidate.name.toLowerCase() === column.reference?.column.toLowerCase(),
        );
        if (!target)
          issues.push({
            path: `${path}.reference.table`,
            message: `Unknown referenced table "${column.reference.table}".`,
          });
        else if (!targetColumn)
          issues.push({
            path: `${path}.reference.column`,
            message: `Unknown referenced column "${column.reference.column}".`,
          });
        else {
          if (!targetColumn.primaryKey)
            issues.push({
              path: `${path}.reference.column`,
              message: 'References must target the table primary key.',
            });
          if (targetColumn.type !== column.type)
            issues.push({
              path: `${path}.reference.column`,
              message: 'Reference column types must match.',
            });
        }
        if (
          column.reference.onDelete &&
          !['cascade', 'set null', 'restrict', 'no action'].includes(column.reference.onDelete)
        ) {
          issues.push({
            path: `${path}.reference.onDelete`,
            message: `Unsupported ON DELETE action "${column.reference.onDelete}".`,
          });
        }
      }
    }
    if (primaryKeys > 1)
      issues.push({
        path: `${tablePath}.columns`,
        message: 'Only one primary-key column is supported per table.',
      });
  }
  return issues;
}

function quoteIdentifier(identifier: string, dialect: SqlDialect): string {
  if (!identifier.trim() || /[\u0000-\u001f\u007f]/.test(identifier))
    throw new Error('SQL identifiers must be non-empty and contain no control characters.');
  if (dialect === 'mysql') return `\`${identifier.replace(/`/g, '``')}\``;
  return `"${identifier.replace(/"/g, '""')}"`;
}

function sqlType(type: ColumnType, dialect: SqlDialect): string {
  const types: Record<ColumnType, Record<SqlDialect, string>> = {
    integer: { postgres: 'INTEGER', mysql: 'INT', sqlite: 'INTEGER' },
    real: { postgres: 'DOUBLE PRECISION', mysql: 'DOUBLE', sqlite: 'REAL' },
    text: { postgres: 'TEXT', mysql: 'TEXT', sqlite: 'TEXT' },
    boolean: { postgres: 'BOOLEAN', mysql: 'BOOLEAN', sqlite: 'INTEGER' },
    date: { postgres: 'DATE', mysql: 'DATE', sqlite: 'TEXT' },
    datetime: { postgres: 'TIMESTAMP', mysql: 'DATETIME', sqlite: 'TEXT' },
    json: { postgres: 'JSONB', mysql: 'JSON', sqlite: 'TEXT' },
  };
  return types[type][dialect];
}

export function exportSql(schema: RelationalSchema, dialect: SqlDialect): string {
  if (!['postgres', 'mysql', 'sqlite'].includes(dialect))
    throw new Error(`Unsupported SQL dialect "${dialect}".`);
  const issues = validateSchema(schema);
  if (issues.length)
    throw new Error(
      `Cannot export invalid schema: ${issues.map((issue) => issue.message).join(' ')}`,
    );
  return schema.tables
    .map((table) => {
      const parts = table.columns.map((column) => {
        let definition = `${quoteIdentifier(column.name, dialect)} ${sqlType(column.type, dialect)}`;
        if (column.primaryKey) definition += ' PRIMARY KEY';
        else if (!column.nullable) definition += ' NOT NULL';
        if (column.reference) {
          definition += ` REFERENCES ${quoteIdentifier(column.reference.table, dialect)} (${quoteIdentifier(column.reference.column, dialect)})`;
          if (column.reference.onDelete)
            definition += ` ON DELETE ${column.reference.onDelete.toUpperCase()}`;
        }
        return definition;
      });
      return `CREATE TABLE ${quoteIdentifier(table.name, dialect)} (\n  ${parts.join(',\n  ')}\n);`;
    })
    .join('\n\n');
}

export function createEmptySchema(): RelationalSchema {
  return {
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'integer', primaryKey: true },
          { name: 'name', type: 'text' },
        ],
      },
    ],
  };
}

export interface SchemaDesignerProps {
  value: RelationalSchema;
  onChange: (value: RelationalSchema) => void;
  dialect?: SqlDialect;
  onDialectChange?: (dialect: SqlDialect) => void;
  className?: string;
}

const columnTypes: ColumnType[] = [
  'integer',
  'real',
  'text',
  'boolean',
  'date',
  'datetime',
  'json',
];

export function SchemaDesigner({
  value,
  onChange,
  dialect = 'postgres',
  onDialectChange,
  className,
}: SchemaDesignerProps): React.ReactElement {
  const issues = validateSchema(value);
  const changeTable = (index: number, patch: Partial<SchemaTable>) =>
    onChange({
      ...value,
      tables: value.tables.map((table, i) => (i === index ? { ...table, ...patch } : table)),
    });
  const changeColumn = (tableIndex: number, columnIndex: number, patch: Partial<SchemaColumn>) =>
    changeTable(tableIndex, {
      columns: value.tables[tableIndex].columns.map((column, i) =>
        i === columnIndex ? { ...column, ...patch } : column,
      ),
    });
  let sql = '';
  if (!issues.length) {
    try {
      sql = exportSql(value, dialect);
    } catch {
      sql = '';
    }
  }
  return (
    <section className={`lp-schema ${className ?? ''}`} aria-label="Database schema designer">
      <header className="lp-schema__header">
        <div>
          <h2>Schema designer</h2>
          <p>Shape a relational model and preview validated SQL.</p>
        </div>
        <label>
          SQL dialect
          <select
            value={dialect}
            disabled={!onDialectChange}
            onChange={(event) => onDialectChange?.(event.target.value as SqlDialect)}
            aria-label="SQL dialect"
          >
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="sqlite">SQLite</option>
          </select>
        </label>
      </header>
      {value.tables.map((table, tableIndex) => (
        <article className="lp-schema__table" key={`${tableIndex}-${table.name}`}>
          <div className="lp-schema__table-head">
            <label>
              Table name
              <input
                aria-label={`Table ${tableIndex + 1} name`}
                value={table.name}
                onChange={(event) => changeTable(tableIndex, { name: event.target.value })}
              />
            </label>
            <button
              type="button"
              aria-label={`Remove table ${table.name}`}
              onClick={() =>
                onChange({ ...value, tables: value.tables.filter((_, i) => i !== tableIndex) })
              }
            >
              Remove table
            </button>
          </div>
          <div className="lp-schema__columns">
            {table.columns.map((column, columnIndex) => (
              <div className="lp-schema__column" key={`${columnIndex}-${column.name}`}>
                <label>
                  Column
                  <input
                    aria-label={`Table ${table.name} column ${columnIndex + 1} name`}
                    value={column.name}
                    onChange={(event) =>
                      changeColumn(tableIndex, columnIndex, { name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    aria-label={`Table ${table.name} column ${columnIndex + 1} type`}
                    value={column.type}
                    onChange={(event) =>
                      changeColumn(tableIndex, columnIndex, {
                        type: event.target.value as ColumnType,
                      })
                    }
                  >
                    {columnTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lp-schema__check">
                  <input
                    aria-label={`Table ${table.name} column ${column.name} primary key`}
                    type="checkbox"
                    checked={Boolean(column.primaryKey)}
                    onChange={(event) =>
                      changeColumn(tableIndex, columnIndex, {
                        primaryKey: event.target.checked,
                        nullable: event.target.checked ? false : column.nullable,
                      })
                    }
                  />{' '}
                  PK
                </label>
                <label className="lp-schema__check">
                  <input
                    aria-label={`Table ${table.name} column ${column.name} nullable`}
                    type="checkbox"
                    checked={column.nullable !== false}
                    disabled={Boolean(column.primaryKey)}
                    onChange={(event) =>
                      changeColumn(tableIndex, columnIndex, { nullable: event.target.checked })
                    }
                  />{' '}
                  Nullable
                </label>
                <label>
                  References
                  <select
                    aria-label={`Table ${table.name} column ${columnIndex + 1} reference`}
                    value={
                      column.reference
                        ? JSON.stringify([column.reference.table, column.reference.column])
                        : ''
                    }
                    onChange={(event) => {
                      if (!event.target.value)
                        changeColumn(tableIndex, columnIndex, { reference: undefined });
                      else {
                        const [tableName, columnName] = JSON.parse(event.target.value) as [
                          string,
                          string,
                        ];
                        changeColumn(tableIndex, columnIndex, {
                          reference: { table: tableName, column: columnName },
                        });
                      }
                    }}
                  >
                    <option value="">None</option>
                    {value.tables.flatMap((candidate) =>
                      candidate.columns.map((target) => (
                        <option
                          key={JSON.stringify([candidate.name, target.name])}
                          value={JSON.stringify([candidate.name, target.name])}
                        >
                          {candidate.name}.{target.name}
                        </option>
                      )),
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={`Remove column ${column.name}`}
                  onClick={() =>
                    changeTable(tableIndex, {
                      columns: table.columns.filter((_, i) => i !== columnIndex),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              changeTable(tableIndex, {
                columns: [
                  ...table.columns,
                  { name: `column_${table.columns.length + 1}`, type: 'text', nullable: true },
                ],
              })
            }
          >
            Add column
          </button>
        </article>
      ))}
      <button
        className="lp-schema__add-table"
        type="button"
        onClick={() =>
          onChange({
            ...value,
            tables: [...value.tables, { name: `table_${value.tables.length + 1}`, columns: [] }],
          })
        }
      >
        Add table
      </button>
      {issues.length > 0 && (
        <div className="lp-schema__errors" role="alert">
          <strong>Schema needs attention</strong>
          <ul>
            {issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="lp-schema__preview">
        <h3>{dialect.toUpperCase()} export preview</h3>
        <pre>{sql || 'Resolve validation errors to preview SQL.'}</pre>
      </div>
    </section>
  );
}
