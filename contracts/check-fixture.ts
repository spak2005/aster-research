/** Checked alongside every web build: source fixture and TypeScript contract agree. */
import fixture from './examples/contract-test.json';
import type {Recording} from './recording';
// JSON imports widen string literals; this compile-time shape check keeps nested
// fields, dimensions, units and nullability aligned without blessing enum strings.
type WidenStrings<T> = T extends string ? string : T extends readonly [infer A, infer B]
  ? WidenStrings<A | B>[] : T extends (infer E)[] ? WidenStrings<E>[]
  : T extends object ? {[K in keyof T]: WidenStrings<T[K]>} : T;
const checked: WidenStrings<Recording> = fixture;
void checked;
