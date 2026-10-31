import { Value, bool, list, map, nothing, num, text } from '@northtalk/ts';

// Plain sim data to NorthTalk Values and back (#194). The sim's state is
// JSON-shaped: null, booleans, numbers, strings, arrays and plain
// objects. null and undefined become Nothing, and Nothing comes back as
// null. Numbers go in as the decimal of their shortest round-trip text
// and come back as the nearest double, which is exact for the integers
// the sim holds.

//
// Each object or array and the Value made from it are remembered as a
// pair, both ways. An entry a tick leaves alone comes back from the
// script as the same Value, so it converts back to the same object, and
// that object crosses again as that Value, whose size NorthTalk has
// already measured. This relies on the sim never changing state in
// place, which it doesn't.

export type Plain =
  boolean | null | number | Plain[] | string | { [key: string]: Plain };

const valueOf = new WeakMap<object, Value>();
const plainOf = new WeakMap<Value, Plain>();

const pair = (plain: object, value: Value): void => {
  valueOf.set(plain, value);
  plainOf.set(value, plain as Plain);
};

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
      const known = valueOf.get(plain);
      if (known) {
        return known;
      }
      const value = Array.isArray(plain)
        ? list(...plain.map(toValue))
        : map(
            Object.entries(plain).map(([key, field]) => [key, toValue(field)])
          );
      pair(plain, value);
      return value;
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
      const known = plainOf.get(value);
      if (known !== undefined) {
        return known;
      }
      // Value.index counts from 1, as a Script does.
      const items: Plain[] = [];
      for (let i = 1; i <= value.length; i++) {
        items.push(fromValue(value.index(i)));
      }
      pair(items, value);
      return items;
    }
    case 'map': {
      const known = plainOf.get(value);
      if (known !== undefined) {
        return known;
      }
      const fields: Record<string, Plain> = {};
      for (const [key, field] of value.entries()) {
        fields[key] = fromValue(field);
      }
      pair(fields, value);
      return fields;
    }
    default:
      throw new Error(`Not plain data: a ${value.kind}`);
  }
};
