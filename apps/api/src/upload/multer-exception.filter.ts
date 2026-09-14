import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  PayloadTooLargeException,
  BadRequestException,
} from '@nestjs/common'
import { MulterError } from 'multer'
import {
  formatUploadMaxLabel,
  resolveUploadMaxBytes,
} from './upload-limits'

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()

    if (exception.code === 'LIMIT_FILE_SIZE') {
      const max = resolveUploadMaxBytes()
      const err = new PayloadTooLargeException(
        `File too large. Maximum upload size is ${formatUploadMaxLabel(max)}.`,
      )
      return response.status(err.getStatus()).json(err.getResponse())
    }

    const err = new BadRequestException(exception.message)
    return response.status(err.getStatus()).json(err.getResponse())
  }
}
