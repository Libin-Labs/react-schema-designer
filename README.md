# @lp-labs/react-schema-designer

Package version: `1.0.0`. Requires React `^18.2.0 || ^19.0.0`
as its only runtime peer. ESM and CommonJS named exports are provided.

```sh
npm install @lp-labs/react-schema-designer react
```

An independent typed relational-schema model, validator, controlled React editor, and SQL text exporter for PostgreSQL, MySQL, and SQLite. SQL is generated for review only; the package does not connect to, execute against, or modify a database.

## Install and render

```tsx
import { SchemaDesigner, createEmptySchema } from "@lp-labs/react-schema-designer";
import { useState } from "react";
import "@lp-labs/react-schema-designer/style.css";

function Design() {
  const [schema, setSchema] = useState(createEmptySchema());
  const [dialect, setDialect] = useState<"postgres" | "mysql" | "sqlite">("postgres");
  return <SchemaDesigner value={schema} onChange={setSchema}
    dialect={dialect} onDialectChange={setDialect} />;
}
```

`SchemaDesigner` is fully controlled: all table and column changes are emitted as new values through `onChange`. The `dialect` prop selects SQL preview syntax; provide `onDialectChange` to enable editing the dialect selector. `className` adds a wrapper class. The stylesheet is optional.

## Schema and exports

```ts
import {
  createEmptySchema, validateSchema, exportSql,
  type RelationalSchema, type SqlDialect
} from "@lp-labs/react-schema-designer";

const schema: RelationalSchema = {
  tables: [
    { name: "accounts", columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "display_name", type: "text", nullable: false }
    ] },
    { name: "invoices", columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "account_id", type: "integer", reference: {
        table: "accounts", column: "id", onDelete: "cascade"
      } }
    ] }
  ]
};

const issues = validateSchema(schema); // { path, message }[]
const dialect: SqlDialect = "postgres";
if (issues.length === 0) console.log(exportSql(schema, dialect));
```

Column types are `integer`, `real`, `text`, `boolean`, `date`, `datetime`, and `json`. A missing `nullable` means NOT NULL in exported SQL; a primary key is always non-null. `reference` optionally carries `onDelete`: `cascade`, `set null`, `restrict`, or `no action`. Validation reports empty tables, duplicate names, invalid references, mismatched reference types, nullable primary keys, and multiple primary keys. References target the referenced table's primary key. `exportSql` throws for an invalid model or unsupported dialect and quotes identifiers using the selected dialect's quote convention; embedded quote characters are escaped.

### Complete public surface

Runtime named exports are `SchemaDesigner`, `createEmptySchema`,
`validateSchema`, and `exportSql`. Type-only exports are `ColumnType`,
`SqlDialect`, `ForeignKey`, `SchemaColumn`, `SchemaTable`, `RelationalSchema`,
`SchemaIssue`, and `SchemaDesignerProps`.

```ts
type ColumnType = "integer" | "real" | "text" | "boolean" | "date" | "datetime" | "json";
type SqlDialect = "postgres" | "mysql" | "sqlite";
interface ForeignKey {
  table: string;
  column: string;
  onDelete?: "cascade" | "set null" | "restrict" | "no action";
}
interface SchemaColumn {
  name: string;
  type: ColumnType;
  nullable?: boolean;
  primaryKey?: boolean;
  reference?: ForeignKey;
}
interface SchemaTable { name: string; columns: SchemaColumn[] }
interface RelationalSchema { tables: SchemaTable[] }
interface SchemaIssue { path: string; message: string }
```

`SchemaDesignerProps`:

| Prop | Default / callback contract |
| --- | --- |
| `value: RelationalSchema` | Required controlled schema |
| `onChange: (value: RelationalSchema) => void` | Required; replace parent state on each edit |
| `dialect?: SqlDialect` | `"postgres"` |
| `onDialectChange?: (dialect: SqlDialect) => void` | Absent; selector disabled without it |
| `className?: string` | No added class |

`createEmptySchema(): RelationalSchema` returns a fresh starter with one `users`
table: integer primary-key `id`, and text `name`. It is not an empty table list.
`validateSchema(schema: RelationalSchema): SchemaIssue[]` returns an empty list
for valid models. It is not an `unknown` JSON parser: malformed shapes can throw
native errors. Name duplicate/reference matching is case-insensitive.
`exportSql(schema: RelationalSchema, dialect: SqlDialect): string` requires an
explicit dialect and throws plain Error for unsupported dialect or validation
issues. Both helpers are synchronous and do not mutate the supplied model.
Missing `primaryKey` means false, missing `reference` means none; missing
`onDelete` emits no clause. The validator does not enforce that SET NULL targets
a nullable column; review that combination yourself.

Fixed SQL type mappings:

| Model type | PostgreSQL | MySQL | SQLite |
| --- | --- | --- | --- |
| integer | INTEGER | INT | INTEGER |
| real | DOUBLE PRECISION | DOUBLE | REAL |
| text | TEXT | TEXT | TEXT |
| boolean | BOOLEAN | BOOLEAN | INTEGER |
| date | DATE | DATE | TEXT |
| datetime | TIMESTAMP | DATETIME | TEXT |
| json | JSONB | JSON | TEXT |

## Validation, customization, and limits

The UI edits tables, columns, primary keys, nullability, and references, and shows validation issues next to a generated SQL preview. Use `validateSchema` before storing or exporting user-supplied documents. The SQL exporter only emits `CREATE TABLE` statements and uses fixed type mappings. It does not preserve vendor-specific defaults, indexes, composite keys, migrations, or constraints beyond single-column primary keys and inline foreign keys. Exported SQL is a starting point for review, not a guarantee of production compatibility.

Inputs are labeled, focus-visible, and errors use an alert region. Customize `.lp-schema` and `.lp-schema__*` classes or supply your own styles.

No connections, asynchronous tasks, workers, persistence, subscriptions, or
cancellation APIs are created. Parent applications own state and saving.
Import is browser-global-free; render the editor in your application's React
renderer. React types are needed for TypeScript JSX; Node ambient declarations
are not required. Tables, columns, validation, and SQL are processed in full on
edits; there is no virtualization or large-schema latency guarantee.

## Project

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
