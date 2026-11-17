const { createApplication } = require('../apps/api/dist/bootstrap');

let application;

module.exports = async function handler(request, response) {
  Reflect.deleteProperty(request, 'query');
  application ??= createApplication().catch((error) => {
    application = undefined;
    throw error;
  });
  try {
    const app = await application;
    return app.getHttpAdapter().getInstance()(request, response);
  } catch {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message:
          'The API could not start. Check the deployment environment and database connection.',
      }),
    );
  }
};
