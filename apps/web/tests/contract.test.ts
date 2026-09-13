import { expect, test } from "vitest";
import { z } from "zod";
import openapi from "../src/api/openapi.json";
import {
  assumptionSchema,
  bookLevelSchema,
  evidenceSchema,
  instrumentSchema,
  scenarioSchema,
  stateSchema,
  thesisInputSchema,
  thesisSummarySchema,
} from "../src/api/schemas";

/**
 * Guards the client half of the contract: every model the backend publishes in
 * its OpenAPI description is mirrored field-for-field by the zod schema the
 * client validates with. The backend half is guarded by
 * tests/test_openapi_snapshot.py, which fails if openapi.json falls behind the
 * application. Together they make a silent contract drift impossible.
 *
 * Required-ness is deliberately not compared: Pydantic omits fields carrying
 * defaults from `required`, while the client still always receives them.
 */
type Property = {
  enum?: (string | number)[];
  const?: string | number;
  [key: string]: unknown;
};

/** A standalone enum component such as `State` carries no properties. */
type Component = {
  properties?: Record<string, Property>;
  enum?: (string | number)[];
};

const components: Record<string, Component> = openapi.components.schemas;

const mirrored: [string, z.ZodObject][] = [
  ["Assumption-Input", assumptionSchema],
  ["Assumption-Output", assumptionSchema],
  ["ThesisInput", thesisInputSchema],
  ["ThesisSummary", thesisSummarySchema],
  ["Evidence", evidenceSchema],
  ["Instrument", instrumentSchema],
  ["StressInput", scenarioSchema],
  ["BookLevel", bookLevelSchema],
];

/**
 * The fixed set a backend property allows, following the three shapes Pydantic
 * emits: an inline `enum`, a single-value `const`, and an optional field as an
 * `anyOf` of one real branch plus null. A `$ref` resolves to its component.
 */
function closedValuesOf(property: Property): string[] | null {
  if (property.enum) return property.enum.map(String);
  if (property.const !== undefined) return [String(property.const)];
  if (typeof property.$ref === "string") {
    const referenced = components[property.$ref.split("/").pop() ?? ""];
    return referenced?.enum?.map(String) ?? null;
  }
  if (Array.isArray(property.anyOf)) {
    const branches = (property.anyOf as Property[]).filter(
      (branch) => branch.type !== "null",
    );
    if (branches.length === 1) return closedValuesOf(branches[0]);
  }
  return null;
}

function backendClosedValues(properties: Record<string, Property>) {
  return Object.entries(properties).flatMap(([field, property]) => {
    const values = closedValuesOf(property);
    return values ? [[field, [...values].sort()] as const] : [];
  });
}

/** Optional and nullable wrappers must not hide the enum they carry. */
function unwrap(value: unknown): unknown {
  let current = value;
  while (current instanceof z.ZodOptional || current instanceof z.ZodNullable)
    current = current.unwrap();
  return current;
}

/** Fields the client restricts to a fixed set, by z.literal or z.enum. */
function clientClosedValues(shape: z.ZodObject["shape"]) {
  return Object.entries(shape).flatMap(([field, value]) => {
    const inner = unwrap(value);
    if (inner instanceof z.ZodEnum)
      return [[field, [...inner.options].sort()] as const];
    if (inner instanceof z.ZodLiteral)
      return [[field, [...inner.values].map(String).sort()] as const];
    return [];
  });
}

test.each(mirrored)(
  "%s field names match the backend model",
  (name, schema) => {
    expect(Object.keys(schema.shape).sort()).toEqual(
      Object.keys(components[name].properties ?? {}).sort(),
    );
  },
);

test.each(mirrored)(
  "%s closed value sets match the backend model",
  (name, schema) => {
    expect(Object.fromEntries(clientClosedValues(schema.shape))).toEqual(
      Object.fromEntries(
        backendClosedValues(components[name].properties ?? {}),
      ),
    );
  },
);

test("the shared assessment states match the backend enum", () => {
  expect([...stateSchema.options].sort()).toEqual(
    [...(components.State.enum ?? [])].sort(),
  );
});
