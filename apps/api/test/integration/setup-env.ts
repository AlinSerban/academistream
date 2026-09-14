import dotenv from 'dotenv'
import path from 'path'

dotenv.config({
  path: path.resolve(__dirname, '../../../../.env'),
})

process.env.DATABASE_URL ??=
  'postgres://academistream:academistream@localhost:5432/academistream'
process.env.JWT_SECRET ??= 'secret'
process.env.REDIS_URL ??= 'redis://localhost:16379'
process.env.STORAGE_PROVIDER ??= 'local'
process.env.STORAGE_LOCAL_ROOT ??= path.resolve(
  __dirname,
  '../../../../.data/media-test',
)
process.env.WEB_ORIGIN ??= 'http://localhost:5173'
