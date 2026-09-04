import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'DCEP API (Distributed Code Execution Platform)',
            version: '1.0.0',
            description: 'API documentation for compiling and executing untrusted code.',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local Development Server',
            }
        ],
    },
    apis: ['./src/api/routes/*.js', './src/api/server.js'], 
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};