import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { KafkaConsumerService } from './kafka/kafka.consumer';
import { NotificationsModule } from './notifications/notifications.module';
import { VideoProcessingService } from './video/video-processing.service';
import { MediaConvertCompletionPoller } from './video/media-convert-completion.poller';
import { MediaEventsConsumerService } from './kafka/media-events-consumer-service';
import { KafkaProducerService } from './kafka/kafka.producer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DbModule,
    NotificationsModule
  ],
  providers: [
    VideoProcessingService,
    KafkaConsumerService,
    MediaEventsConsumerService,
    MediaConvertCompletionPoller,
    KafkaProducerService
  ],
})
export class AppModule { }
