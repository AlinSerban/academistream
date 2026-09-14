import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import cookieParser from 'cookie-parser'
import { MulterExceptionFilter } from './upload/multer-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const port = process.env.PORT ?? 3000
  // Needed so req.ip reflects the client behind a reverse proxy (demo/hosting).
  app.set('trust proxy', 1)
  app.use(cookieParser())
  app.useGlobalFilters(new MulterExceptionFilter())
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
  await app.listen(port)
}
bootstrap()
