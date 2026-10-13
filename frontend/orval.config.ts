import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'orval';
import { z } from 'zod';

const SPEC_PATH = path.resolve(import.meta.dirname, 'openapi.json');
const MUTATOR_PATH = './src/apis/fetcher.ts';

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

const responseSchema = z.object({
  content: z.record(z.string(), z.object({ schema: z.unknown() })).optional(),
});

const operationSchema = z.object({
  operationId: z.string(),
  responses: z.record(z.string(), responseSchema),
});

const specSchema = z.object({
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
});

type Operation = z.infer<typeof operationSchema>;

const getSuccessResponses = (operation: Operation) =>
  Object.entries(operation.responses)
    .filter(([status]) => status.startsWith('2'))
    .map(([, response]) => response);

const hasSuccessBody = (operation: Operation) =>
  getSuccessResponses(operation).some(
    (response) => response.content !== undefined,
  );

const hasUntypedJsonBody = (operation: Operation) =>
  getSuccessResponses(operation).some((response) => {
    const jsonSchema = response.content?.['application/json']?.schema;

    return (
      typeof jsonSchema === 'object' &&
      jsonSchema !== null &&
      Object.keys(jsonSchema).every(
        (key) => key === 'title' || key === 'description',
      )
    );
  });

const spec = specSchema.parse(JSON.parse(readFileSync(SPEC_PATH, 'utf-8')));

const operations = Object.values(spec.paths).flatMap((pathItem) =>
  Object.entries(pathItem)
    .filter(([key]) => HTTP_METHODS.has(key))
    .map(([, operation]) => operationSchema.parse(operation)),
);

const untypedOperationIds = operations
  .filter(hasUntypedJsonBody)
  .map((operation) => operation.operationId);

if (untypedOperationIds.length > 0) {
  throw new Error(
    `응답 스키마가 비어 있어 응답을 검증할 수 없는 API가 있습니다. BE에 response_model 지정을 요청하세요: ${untypedOperationIds.join(', ')}`,
  );
}

const noContentOperations = Object.fromEntries(
  operations
    .filter((operation) => !hasSuccessBody(operation))
    .map((operation) => [
      operation.operationId,
      { mutator: { path: MUTATOR_PATH, name: 'noContentFetcher' } },
    ]),
);

export default defineConfig({
  closetFairy: {
    input: {
      target: SPEC_PATH,
    },
    output: {
      target: './src/generated/endpoints',
      schemas: {
        path: './src/generated/models',
        type: 'zod',
      },
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'tags-split',
      clean: true,
      formatter: 'prettier',
      mock: false,
      override: {
        mutator: {
          path: MUTATOR_PATH,
          name: 'fetcher',
        },
        operations: noContentOperations,
        includeZodSchemaInArguments: true,
        fetch: {
          runtimeValidation: true,
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});
