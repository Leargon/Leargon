import { defineConfig } from 'orval';
export default defineConfig({
    leargon: {
        input: {
            target: '../leargon-backend/src/main/resources/openapi.yaml',
        },
        output: {
            target: './src/api/generated/endpoints.ts',
            schemas: './src/api/generated/model',
            client: 'react-query',
            baseUrl: 'http://localhost:8081',
            mode: 'tags-split',
            prettier: true,
            override: {
                mutator: {
                    path: './src/api/customAxios.ts',
                    names: 'customAxios',
                },
                query: {
                    useQuery: true,
                    useMutation: true,
                },
            },
        },
    },
});
