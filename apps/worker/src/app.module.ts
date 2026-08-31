import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { KafkaConsumerService } from './kafka/kafka.consumer';
import { NotificationsModule } from './notifications/notifications.module';
import { VideoProcessingService } from './video/video-processing.service';
import { MediaConvertCompletionPoller } from './video/media-convert-completion.poller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DbModule,
    NotificationsModule,
  ],
  providers: [
    AppService,
    VideoProcessingService,
    KafkaConsumerService,
    MediaConvertCompletionPoller,
  ],
})
export class AppModule {}
