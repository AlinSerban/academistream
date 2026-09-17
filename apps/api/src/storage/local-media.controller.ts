import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createReadStream, statSync } from 'fs'
import type { Request, Response } from 'express'
import { Public } from '../auth/public.decorator'
import { STORAGE } from './storage.tokens'
import { LocalStorageService } from './local.storage'
import { verifyLocalMediaSignature } from './local-media-url'
import { assertValidStorageKey } from './storage-key'

@Controller('local-media')
export class LocalMediaController {
  constructor(
    private readonly config: ConfigService,
    @Inject(STORAGE) private readonly storage: unknown,
  ) {}

  @Public()
  @Get()
  stream(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!key || !exp || !sig) throw new ForbiddenException('Missing media signature')
    assertValidStorageKey(key)

    const secret = this.config.get<string>('JWT_SECRET')?.trim()
    if (!secret) throw new ForbiddenException('Media signing is not configured')

    if (!verifyLocalMediaSignature({ key, exp, sig, secret })) {
      throw new ForbiddenException('Invalid or expired media URL')
    }

    if (!(this.storage instanceof LocalStorageService)) {
      throw new NotFoundException('Local media is not available')
    }

    let filePath: string
    try {
      filePath = this.storage.resolvePath(key)
    } catch {
      throw new NotFoundException()
    }

    let stat
    try {
      stat = statSync(filePath)
    } catch {
      throw new NotFoundException()
    }

    const contentType = contentTypeForKey(key)
    const total = stat.size
    const range = req.headers.range

    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=60')

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!match) {
        res.status(416).end()
        return
      }
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Number(match[2]) : total - 1
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end >= total ||
        start > end
      ) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end()
        return
      }
      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`)
      res.setHeader('Content-Length', String(end - start + 1))
      res.setHeader('Content-Type', contentType)
      createReadStream(filePath, { start, end }).pipe(res)
      return
    }

    res.status(200)
    res.setHeader('Content-Length', String(total))
    res.setHeader('Content-Type', contentType)
    createReadStream(filePath).pipe(res)
  }
}

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase()
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.m4v')) return 'video/x-m4v'
  return 'application/octet-stream'
}
