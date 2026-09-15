import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, type Producer } from 'kafkajs';
import type { VideoMediaEventsJob } from '../types';
import { ensureKafkaTopics } from './ensure-topics';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KafkaProducerService.name);
    private readonly topic: string;
    private readonly brokers: string[];
    private producer: Producer;

    constructor(private readonly config: ConfigService) {
        this.brokers = (config.get<string>('KAFKA_BROKERS') ?? 'localhost:29092')
            .split(',')
            .map((b) => b.trim())
            .filter(Boolean);

        this.topic =
            config.get<string>('KAFKA_MEDIA_EVENTS_TOPIC') ?? 'video.events.topic';

        const kafka = new Kafka({
            clientId: 'academistream-worker-producer',
            brokers: this.brokers,
        });
        this.producer = kafka.producer();
    }

    async onModuleInit() {
        await ensureKafkaTopics(this.brokers, [this.topic]);
        await this.producer.connect();
        this.logger.log(
            `Kafka producer connected (topic=${this.topic})`,
        );
    }

    async onModuleDestroy() {
        await this.producer.disconnect();
    }

    async sendMediaEventProcessingJob(job: VideoMediaEventsJob): Promise<void> {
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
