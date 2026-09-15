import { Logger } from '@nestjs/common';
import { Kafka, logLevel } from 'kafkajs';

const logger = new Logger('KafkaTopics');

/** Ensure local/dev topics exist before consumers subscribe (avoids crash on empty broker). */
export async function ensureKafkaTopics(
  brokers: string[],
  topics: string[],
  clientId = 'academistream-topic-bootstrap',
): Promise<void> {
  const unique = [...new Set(topics.filter(Boolean))];
  if (unique.length === 0) return;

  const kafka = new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.ERROR,
  });
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = await admin.listTopics();
    const missing = unique.filter((t) => !existing.includes(t));
    if (missing.length === 0) return;

    const created = await admin.createTopics({
      topics: missing.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
      waitForLeaders: true,
    });
    logger.log(
      created
        ? `Created Kafka topics: ${missing.join(', ')}`
        : `Kafka topics already present or racing create: ${missing.join(', ')}`,
    );
  } finally {
    await admin.disconnect();
  }
}
