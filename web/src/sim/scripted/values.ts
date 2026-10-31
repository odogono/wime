import { Value, bool, list, map, nothing, num, text } from '@northtalk/ts';

// Plain sim data to NorthTalk Values and back (#194). The sim's state is
// JSON-shaped: null, booleans, numbers, strings, arrays and plain
// objects. null and undefined become Nothing, and Nothing comes back as
// null. Numbers go in as the decimal of their shortest round-trip text
// and come back as the nearest double, which is exact for the integers
// the sim holds.

export type Plain =
  boolean | null | number | Plain[] | string | { [key: string]: Plain };

export const toValue = (plain: unknown): Value => {
  if (plain === null || plain === undefined) {
    return nothing;
  }
  switch (typeof plain) {
    case 'boolean':
      return bool(plain);
    case 'number':
      return num(plain);
    case 'string':
      return text(plain);
    case 'object': {
      if (Array.isArray(plain)) {
        return list(...plain.map(toValue));
      }
      return map(
        Object.entries(plain).map(([key, value]) => [key, toValue(value)])
      );
    }
    default:
      throw new Error(`Not plain data: ${typeof plain}`);
  }
};

export const fromValue = (value: Value): Plain => {
  switch (value.kind) {
    case 'nothing':
      return null;
    case 'boolean':
      return value.asBool()!;
    case 'number':
      return value.asDecimal()!.toNumberLossy();
    case 'text':
      return value.asText()!;
    case 'list': {
      // Value.index counts from 1, as a Script does.
      const items: Plain[] = [];
      for (let i = 1; i <= value.length; i++) {
        items.push(fromValue(value.index(i)));
      }
      return items;
    }
    case 'map': {
      const fields: Record<string, Plain> = {};
      for (const [key, field] of value.entries()) {
        fields[key] = fromValue(field);
      }
      return fields;
    }
    default:
      throw new Error(`Not plain data: a ${value.kind}`);
  }
};
