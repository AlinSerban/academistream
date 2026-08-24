import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, type Producer } from 'kafkajs';
import type { VideoProcessingJob } from './kafka.types';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly topic: string;
  private producer: Producer;

  constructor(private readonly config: ConfigService) {
    const brokers = (config.get<string>('KAFKA_BROKERS') ?? 'localhost:29092')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    this.topic =
      config.get<string>('KAFKA_VIDEO_TOPIC') ?? 'video.processing';

    const kafka = new Kafka({
      clientId: 'academistream-api',
      brokers,
    });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log(
      `Kafka producer connected (topic=${this.topic})`,
    );
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async sendVideoProcessingJob(job: VideoProcessingJob): Promise<void> {
    await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key: String(job.videoId),
          value: JSON.stringify(job),
        },
      ],
    });
  }
}
