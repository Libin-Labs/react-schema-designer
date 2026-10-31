import schema = require('@lp-labs/react-schema-designer');

const model: schema.RelationalSchema = { tables: [] };
schema.validateSchema(model);
