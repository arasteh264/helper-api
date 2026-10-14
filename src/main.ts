import { createApp } from './app-factory';

async function bootstrap() {
  const app = await createApp();

  const port = Number(process.env.PORT ?? 3005);
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api`);
  console.log('🗄️ Database: PostgreSQL');
}

bootstrap();
