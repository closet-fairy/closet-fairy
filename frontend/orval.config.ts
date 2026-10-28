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

const hasRedirectResponse = (operation: Operation) =>
  Object.keys(operation.responses).some((status) => status.startsWith('3'));

const isRedirectOnly = (operation: Operation) =>
  getSuccessResponses(operation).length === 0 && hasRedirectResponse(operation);

const hasNoSuccessOrRedirectResponse = (operation: Operation) =>
  getSuccessResponses(operation).length === 0 &&
  !hasRedirectResponse(operation);

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

const hasNonJsonBody = (operation: Operation) =>
  getSuccessResponses(operation).some(
    (response) =>
      response.content !== undefined &&
      response.content['application/json'] === undefined,
  );

const hasMixedBody = (operation: Operation) => {
  const responses = getSuccessResponses(operation);

  return (
    responses.some((response) => response.content !== undefined) &&
    responses.some((response) => response.content === undefined)
  );
};

const UNSUPPORTED_RESPONSE_RULES = [
  {
    message:
      '응답 스키마가 비어 있어 응답을 검증할 수 없습니다. BE에 response_model 지정을 요청하세요.',
    isMatched: hasUntypedJsonBody,
  },
  {
    message:
      '성공 응답 본문이 JSON이 아니라 fetcher로 검증할 수 없습니다. 이 API에 맞는 mutator를 추가하세요.',
    isMatched: hasNonJsonBody,
  },
  {
    message:
      '본문이 있는 성공 응답과 없는 성공 응답이 섞여 있습니다. 이 API에 맞는 mutator를 추가하세요.',
    isMatched: hasMixedBody,
  },
  {
    message:
      '성공 응답과 리다이렉트 응답이 모두 없습니다. BE에 응답 정의를 요청하세요.',
    isMatched: hasNoSuccessOrRedirectResponse,
  },
];

const rawSpec = z
  .record(z.string(), z.unknown())
  .parse(JSON.parse(readFileSync(SPEC_PATH, 'utf-8')));
const spec = specSchema.parse(rawSpec);

// 리다이렉트만 하는 API는 브라우저가 직접 이동하는 주소라 fetch 클라이언트를 만들지 않는다.
const isGeneratedEntry = ([key, value]: [string, unknown]) =>
  !HTTP_METHODS.has(key) || !isRedirectOnly(operationSchema.parse(value));

const generatedPaths = Object.fromEntries(
  Object.entries(spec.paths).flatMap(([path, pathItem]) => {
    const entries = Object.entries(pathItem).filter(isGeneratedEntry);
    const hasOperation = entries.some(([key]) => HTTP_METHODS.has(key));

    return hasOperation ? [[path, Object.fromEntries(entries)] as const] : [];
  }),
);

const operations = Object.values(generatedPaths).flatMap((pathItem) =>
  Object.entries(pathItem)
    .filter(([key]) => HTTP_METHODS.has(key))
    .map(([, operation]) => operationSchema.parse(operation)),
);

const unsupportedResponseErrors = UNSUPPORTED_RESPONSE_RULES.flatMap((rule) => {
  const operationIds = operations
    .filter(rule.isMatched)
    .map((operation) => operation.operationId);

  return operationIds.length > 0
    ? [`${rule.message} ${operationIds.join(', ')}`]
    : [];
});

if (unsupportedResponseErrors.length > 0) {
  throw new Error(unsupportedResponseErrors.join('\n'));
}

// 옷장 목록은 cursor로 이어 받는 무한 스크롤이라 useInfiniteQuery 훅도 만든다.
const infiniteOperations = {
  list_clothing_clothing_get: {
    query: { useInfinite: true, useInfiniteQueryParam: 'cursor' },
  },
};

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
      target: { ...rawSpec, paths: generatedPaths },
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
        operations: { ...noContentOperations, ...infiniteOperations },
        includeZodSchemaInArguments: true,
        fetch: {
          runtimeValidation: true,
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});
