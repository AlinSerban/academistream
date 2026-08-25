import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, type Consumer } from 'kafkajs';
import { VideoProcessingService } from '../video/video-processing.service';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KafkaConsumerService.name);
    private readonly topic: string;
    private consumer: Consumer;

    constructor(
        private readonly config: ConfigService,
        private readonly videoProcessing: VideoProcessingService,
    ) {
        const brokers = (config.get<string>('KAFKA_BROKERS') ?? 'localhost:29092')
            .split(',')
            .map((b) => b.trim())
            .filter(Boolean);

        this.topic =
            config.get<string>('KAFKA_VIDEO_TOPIC') ?? 'video.processing';

        const kafka = new Kafka({
            clientId: 'academistream-worker',
            brokers,
        });
        this.consumer = kafka.consumer({ groupId: 'video-processing' });
    }

    async onModuleInit() {
        await this.consumer.connect();
        await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
        await this.consumer.run({
            eachMessage: async ({ message }) => {
                const raw = message.value?.toString();
                if (!raw) return;
                const job = JSON.parse(raw);
                await this.videoProcessing.handle(job);
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
