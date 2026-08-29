import fs from 'node:fs';

const typeOf = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

function resolveRef(root, ref) {
  if(!String(ref).startsWith('#/'))throw new Error(`Only local schema refs are supported: ${ref}`);
  return String(ref).slice(2).split('/').reduce((node,key)=>node?.[key.replace(/~1/g,'/').replace(/~0/g,'~')],root);
}

function walk(schema, value, at, errors, root=schema) {
  if(schema.$ref){const target=resolveRef(root,schema.$ref);if(!target){errors.push(`${at} has unresolved schema ref ${schema.$ref}`);return}walk(target,value,at,errors,root);return}
  if (schema.const !== undefined && value !== schema.const) errors.push(`${at} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => item === value)) errors.push(`${at} must be one of ${schema.enum.join(', ')}`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${at} must be ${types.join(' or ')}, got ${typeOf(value)}`);
      return;
    }
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => {
      const trial = [];
      walk(candidate, value, at, trial, root);
      return trial.length === 0;
    }).length;
    if (matches !== 1) errors.push(`${at} must match exactly one oneOf branch`);
  }
  if (schema.not) {
    const trial = [];
    walk(schema.not, value, at, trial, root);
    if (trial.length === 0) errors.push(`${at} matches forbidden schema`);
  }
  for(const child of schema.allOf??[])walk(child,value,at,errors,root);
  if(schema.if){const trial=[];walk(schema.if,value,at,trial,root);if(trial.length===0&&schema.then)walk(schema.then,value,at,errors,root);else if(trial.length&&schema.else)walk(schema.else,value,at,errors,root)}
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at} is shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at} does not match ${schema.pattern}`);
    if(schema.format==='date-time'&&Number.isNaN(Date.parse(value)))errors.push(`${at} must be an ISO date-time`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at} is below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at} is above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at} needs at least ${schema.minItems} item(s)`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at} allows at most ${schema.maxItems} item(s)`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${at} items must be unique`);
    if (schema.items) value.forEach((item, index) => walk(schema.items, item, `${at}[${index}]`, errors, root));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) errors.push(`${at} needs at least ${schema.minProperties} properties`);
    for (const key of schema.required ?? []) if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at} missing required property ${key}`);
    if (schema.propertyNames?.pattern) {
      const pattern = new RegExp(schema.propertyNames.pattern);
      for (const key of keys) if (!pattern.test(key)) errors.push(`${at}.${key} has invalid property name`);
    }
    for (const key of keys) {
      if (schema.properties?.[key]) walk(schema.properties[key], value[key], `${at}.${key}`, errors, root);
      else if (schema.additionalProperties === false) errors.push(`${at}.${key} is not allowed`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') walk(schema.additionalProperties, value[key], `${at}.${key}`, errors, root);
    }
  }
}

export function validateAgainstSchema(value, schema, label = 'value') {
  const errors = [];
  walk(schema, value, label, errors, schema);
  if (errors.length) throw new Error(`Contract validation failed:\n- ${errors.join('\n- ')}`);
}

export function loadAndValidateSchema(schemaPath, value, label) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  validateAgainstSchema(value, schema, label);
}
