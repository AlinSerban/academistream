import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, type Consumer } from 'kafkajs';
import { VideoProcessingService } from '../video/video-processing.service';
import { ensureKafkaTopics } from './ensure-topics';

@Injectable()
export class MediaEventsConsumerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MediaEventsConsumerService.name);
    private readonly topic: string;
    private readonly brokers: string[];
    private consumer: Consumer;

    constructor(
        private readonly config: ConfigService,
        private readonly videoProcessing: VideoProcessingService,
    ) {
        this.brokers = (config.get<string>('KAFKA_BROKERS') ?? 'localhost:29092')
            .split(',')
            .map((b) => b.trim())
            .filter(Boolean);

        this.topic =
            config.get<string>('KAFKA_MEDIA_EVENTS_TOPIC') ?? 'video.events.topic';

        const kafka = new Kafka({
            clientId: 'academistream-worker-events',
            brokers: this.brokers,
        });
        this.consumer = kafka.consumer({ groupId: 'video-events-topic' });
    }

    async onModuleInit() {
        await ensureKafkaTopics(this.brokers, [this.topic]);
        await this.consumer.connect();
        await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
        await this.consumer.run({
            eachMessage: async ({ message }) => {
                const raw = message.value?.toString();
                if (!raw) return;
                const job = JSON.parse(raw);
                await this.videoProcessing.handleEvents(job);
            },
        });
        this.logger.log(
            `Kafka consumer connected (topic=${this.topic})`,
        );
    }

    async onModuleDestroy() {
        await this.consumer.disconnect();
    }
}