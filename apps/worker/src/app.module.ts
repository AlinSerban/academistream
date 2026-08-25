import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { KafkaConsumerService } from './kafka/kafka.consumer';
import { VideoProcessingService } from './video/video-processing.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DbModule,
  ],
  providers: [AppService, VideoProcessingService, KafkaConsumerService],
})
export class AppModule {}
