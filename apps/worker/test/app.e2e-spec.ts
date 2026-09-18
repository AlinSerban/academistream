import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { VideoProcessingService } from './../src/video/video-processing.service';

describe('Worker AppModule (e2e)', () => {
  it('boots application context', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleFixture.get(VideoProcessingService)).toBeDefined();
  });
});
