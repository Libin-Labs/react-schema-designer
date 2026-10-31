import { exportSql, type RelationalSchema, type SqlDialect } from '@lp-labs/react-schema-designer';

const schema: RelationalSchema = { tables: [] };
const dialect: SqlDialect = 'sqlite';
exportSql(schema, dialect);
