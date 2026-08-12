import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';

describe('Worker AppModule (e2e)', () => {
  it('boots application context', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const context = moduleFixture.createNestApplicationContext();
    await context.init();

    const service = context.get(AppService);
    expect(service.getHello()).toBe('Hello World!');

    await context.close();
  });
});
